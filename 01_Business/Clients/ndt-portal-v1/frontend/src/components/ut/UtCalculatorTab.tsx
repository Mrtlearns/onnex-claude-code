import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Printer, Save, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { UtCustomer, UtMaterial, UtSettings, UtDimensions, GeometryType, InspectionClass, RushLevel } from '@/lib/ut/types'
import { GEOMETRY_DEFS, FIELD_LABELS, WEIGHT_ELIGIBLE } from '@/lib/ut/constants'
import { printUtQuote } from '@/lib/printQuote'
import { calculateUt, fetchAvailableVersions } from '@/lib/ut/calculateApi'
import type { CalculateResponse, AvailableVersions, TraceStep } from '@/lib/ut/types-rules'

interface Props {
  customers: UtCustomer[]
  materials: UtMaterial[]
  settings: UtSettings
}

const EMPTY_DIMS: UtDimensions = { thickness: 0, width: 0, length: 0, diameter: 0, od: 0, id_: 0, numScans: 1 }

function LotRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${accent ? 'font-bold text-base border-t mt-1 pt-2' : ''}`}>
      <span className={accent ? '' : 'text-muted-foreground'}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function UtCalculatorTab({ customers, materials, settings }: Props) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [geo, setGeo] = useState<GeometryType>('FLAT_BAR')
  const [dims, setDims] = useState<UtDimensions>(EMPTY_DIMS)
  const [scanIndex, setScanIndex] = useState(0.065)
  const [quantity, setQuantity] = useState(1)
  const [useWeight, setUseWeight] = useState(false)
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '')
  const [inspClass, setInspClass] = useState<InspectionClass>('A')
  const [standard, setStandard] = useState('')
  const [rushLevel, setRushLevel] = useState<RushLevel>('normal')
  const [saving, setSaving] = useState(false)
  const [savedQuote, setSavedQuote] = useState<{ id: string; quoteNumber: string } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Rule engine state
  const [calcResult, setCalcResult] = useState<CalculateResponse | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [availableVersions, setAvailableVersions] = useState<AvailableVersions | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined)
  const [showTrace, setShowTrace] = useState(false)

  const customer = customers.find(c => c.id === customerId) ?? customers[0]
  const geoDef = GEOMETRY_DEFS.find(g => g.id === geo)!
  const canUseWeight = WEIGHT_ELIGIBLE.includes(geo)
  const isCScan = geo === 'CSCAN_FLAT' || geo === 'CSCAN_ROUND'
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Fetch available versions when customer changes
  useEffect(() => {
    if (!customerId) return
    fetchAvailableVersions(customerId)
      .then(v => {
        setAvailableVersions(v)
        setSelectedVersionId(v.selectedVersionId ?? undefined)
      })
      .catch(() => setAvailableVersions(null))
  }, [customerId])

  // Debounced calculation via API
  const doCalculation = useCallback(() => {
    if (!customer) return

    // Check if we have enough dimensions for the geometry
    const hasDims = geo === 'RING'
      ? dims.od > 0 && dims.id_ > 0 && dims.length > 0
      : geo === 'ROUND_BAR' || geo === 'CSCAN_ROUND' || geo === 'TUBING'
        ? dims.diameter > 0 && dims.length > 0
        : dims.width > 0 && dims.length > 0

    if (!hasDims) {
      setCalcResult(null)
      return
    }

    setCalcLoading(true)
    setCalcError(null)

    calculateUt({
      customerId: customer.id,
      geometryType: geo,
      dims: {
        thickness: dims.thickness,
        width: dims.width,
        length: dims.length,
        diameter: dims.diameter,
        od: dims.od,
        id_: dims.id_,
        numScans: dims.numScans,
      },
      scanIndex,
      quantity,
      ruleSetVersionId: selectedVersionId,
      useWeightPricing: useWeight && canUseWeight,
      materialId: useWeight && canUseWeight ? materialId : undefined,
      inspectionClass: useWeight && canUseWeight ? inspClass : undefined,
    })
      .then(result => {
        setCalcResult(result)
        setCalcError(null)
      })
      .catch(err => {
        setCalcError(err instanceof Error ? err.message : 'Calculation failed')
        setCalcResult(null)
      })
      .finally(() => setCalcLoading(false))
  }, [customer, geo, dims, scanIndex, quantity, selectedVersionId, useWeight, canUseWeight, materialId, inspClass])

  // Trigger calculation on input changes with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(doCalculation, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [doCalculation])

  // Derived values from API result
  const scanResult = calcResult?.scanResult ?? null
  const weightResult = calcResult?.weightResult ?? null
  const lotResult = calcResult?.lotResult ?? null
  const finalPrice = calcResult?.trace?.finalResult?.pricePart ?? 0
  const hourlyRate = scanResult ? (calcResult?.trace?.inputs?.hourlyRate as number ?? settings.defaultHourlyRate) : settings.defaultHourlyRate
  const loadTime = scanResult ? (calcResult?.trace?.inputs?.loadTime as number ?? 3) : 3

  const rushMultiplier = rushLevel === 'expedited' ? 1.25 : 1.0
  const rushSurcharge = lotResult ? parseFloat((lotResult.grandTotal * (rushMultiplier - 1)).toFixed(2)) : 0
  const grandTotalFinal = lotResult ? parseFloat((lotResult.grandTotal * rushMultiplier).toFixed(2)) : 0

  function setDim(field: keyof UtDimensions, val: number) {
    setDims(d => ({ ...d, [field]: val }))
  }

  async function handleSave() {
    if (!customer || !scanResult || !lotResult) return
    setSaving(true)
    setSavedQuote(null)
    setSaveError(null)
    try {
      const body = {
        customerId: customer.id,
        standard: standard || undefined,
        rushLevel,
        source: 'portal',
        ruleSetVersionId: selectedVersionId,
        items: [{
          geometryType: geo,
          thickness: dims.thickness || undefined,
          width: dims.width || undefined,
          length: dims.length || undefined,
          diameter: dims.diameter || undefined,
          outerDiameter: dims.od || undefined,
          innerDiameter: dims.id_ || undefined,
          scanIndex,
          quantity,
          numberOfScans: dims.numScans > 1 ? dims.numScans : undefined,
          useWeightPricing: useWeight && canUseWeight,
          materialId: useWeight && canUseWeight ? materialId : undefined,
          inspectionClass: useWeight && canUseWeight ? inspClass : undefined,
        }],
      }
      const res = await fetch('/api/ut/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `Save failed (${res.status})`)
      }
      const data = await res.json() as { quoteId: string; quoteNumber: string }
      setSavedQuote({ id: data.quoteId, quoteNumber: data.quoteNumber })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: inputs */}
      <div className="lg:col-span-2 space-y-6">
        {/* Customer + Version */}
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 items-start flex-wrap">
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers.filter(c => c.isActive).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Rule Set Version Selector */}
              {availableVersions && availableVersions.versions.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Rule Version</Label>
                  <Select
                    value={selectedVersionId ?? ''}
                    onValueChange={v => setSelectedVersionId(v || undefined)}
                  >
                    <SelectTrigger className="w-52 h-8 text-sm">
                      <SelectValue placeholder="Latest" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVersions.versions.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          v{v.version}{v.is_latest ? ' (latest)' : ''}
                          {v.notes ? ` — ${v.notes.slice(0, 30)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Rule set: {availableVersions.ruleSetName}
                  </p>
                </div>
              )}
            </div>
            {customer && (
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span>Rate: <strong>${customer.hourlyRate}/hr</strong></span>
                <span>C-Scan: <strong>${customer.cScanRate}/hr</strong></span>
                <span>Min: <strong>${customer.minCharge}</strong></span>
                {customer.hasTechFee && <span>Tech Fee: <strong>${customer.techniqueFee}</strong></span>}
                <span>Pattern: <Badge variant="outline" className="text-xs">{customer.lotPattern}</Badge></span>
                {customer.notes && <span className="italic">{customer.notes}</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Geometry */}
        <Card>
          <CardHeader><CardTitle className="text-base">Geometry Type</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {GEOMETRY_DEFS.map(g => (
                <button key={g.id} onClick={() => { setGeo(g.id); setDims(EMPTY_DIMS) }}
                  className={`rounded-lg border p-2 text-center text-xs transition-colors ${geo === g.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  <div className="text-lg mb-1">{g.icon}</div>
                  {g.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dimensions &amp; Parameters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {geoDef.fields.map(f => (
                <div key={f} className="space-y-1">
                  <Label htmlFor={`dim-${f}`} className="text-xs">{FIELD_LABELS[f]}</Label>
                  <Input id={`dim-${f}`} type="number" step="any" min={0}
                    value={dims[f as keyof UtDimensions]}
                    onChange={e => setDim(f as keyof UtDimensions, parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm" />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="scan-index" className="text-xs">Scan Index (in)</Label>
                <Input id="scan-index" type="number" step="0.005" min={0.01} value={scanIndex}
                  onChange={e => setScanIndex(parseFloat(e.target.value) || 0.065)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dim-quantity" className="text-xs">Quantity</Label>
                <Input id="dim-quantity" type="number" min={1} value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="standard" className="text-xs">Standard / Spec</Label>
                <Input id="standard" type="text" placeholder="e.g. ASTM A388, Customer Spec"
                  value={standard} onChange={e => setStandard(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rush Level</Label>
                <Select value={rushLevel} onValueChange={v => { setRushLevel(v as RushLevel); setSavedQuote(null) }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="expedited">Expedited (+25%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canUseWeight && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center gap-3 mb-3">
                  <Switch checked={useWeight} onCheckedChange={setUseWeight} />
                  <Label className="text-sm">Weight-based pricing (MAX of time vs weight)</Label>
                </div>
                {useWeight && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Material</Label>
                      <Select value={materialId} onValueChange={setMaterialId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Inspection Class</Label>
                      <Select value={inspClass} onValueChange={v => setInspClass(v as InspectionClass)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Class A</SelectItem>
                          <SelectItem value="AA">Class AA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: results */}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Scan Metrics</CardTitle></CardHeader>
          <CardContent>
            {calcLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating...
              </div>
            ) : calcError ? (
              <p className="text-sm text-destructive">{calcError}</p>
            ) : scanResult ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Scan indexes</span><span>{scanResult.indexes}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sec/scanline</span><span>{scanResult.secPerScanline.toFixed(3)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scan time</span><span>{scanResult.scanTimeMin.toFixed(3)} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Load time</span><span>{loadTime} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total time</span><span>{scanResult.totalTimeMin.toFixed(3)} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Hourly rate</span><span>${hourlyRate}/hr</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>Time price/part</span><span>${scanResult.pricePart.toFixed(2)}</span></div>
                {weightResult && useWeight && (
                  <>
                    <div className="flex justify-between text-muted-foreground"><span>Weight</span><span>{weightResult.weight.toFixed(3)} lb</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Weight price</span><span>${weightResult.weightPrice.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-primary"><span>Effective price/part</span><span>${finalPrice.toFixed(2)}</span></div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Enter dimensions to calculate</p>
            )}
          </CardContent>
        </Card>

        {lotResult && scanResult && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Lot Pricing — {quantity} pc
                {rushLevel === 'expedited' && (
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold">Rush +25%</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LotRow label="Price/part" value={`$${finalPrice.toFixed(2)}`} />
              <LotRow label="Ext. price" value={`$${lotResult.extPrice.toFixed(2)}`} />
              <LotRow label="Lot charge" value={`$${lotResult.lotCharge.toFixed(2)}`} />
              {lotResult.techFee > 0 && <LotRow label="Technique fee" value={`$${lotResult.techFee.toFixed(2)}`} />}
              <LotRow label="Sub-total" value={`$${lotResult.subTotal.toFixed(2)}`} />
              {lotResult.envFee > 0 && <LotRow label="Env. fee (2%)" value={`$${lotResult.envFee.toFixed(2)}`} />}
              {rushLevel === 'expedited' && (
                <LotRow label="Rush surcharge (25%)" value={`$${rushSurcharge.toFixed(2)}`} />
              )}
              <LotRow label="Grand Total" value={`$${grandTotalFinal.toFixed(2)}`} accent />
              {customer && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {customer.deliveryFee !== 'N/A' && <p>Delivery: {customer.deliveryFee}</p>}
                  <p>Lead time: {customer.leadTime}</p>
                  {standard && <p>Standard: {standard}</p>}
                  {calcResult && (
                    <p className="mt-1">
                      Rules: <strong>{calcResult.ruleSetName} v{calcResult.ruleSetVersion}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap mt-4 pt-3 border-t">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => printUtQuote({
                  customerName: customer?.name ?? '',
                  geometry: geoDef.label,
                  dims: Object.fromEntries(geoDef.fields.map(f => [FIELD_LABELS[f], dims[f as keyof UtDimensions]])),
                  scanIndex,
                  quantity,
                  loadTime,
                  hourlyRate,
                  scanIndexes: scanResult.indexes,
                  secPerScanline: scanResult.secPerScanline,
                  scanTimeMin: scanResult.scanTimeMin,
                  totalTimeMin: scanResult.totalTimeMin,
                  timePricePart: scanResult.pricePart,
                  weightPricePart: weightResult?.weightPrice ?? null,
                  useWeight: useWeight && canUseWeight,
                  pricePart: finalPrice,
                  extPrice: lotResult.extPrice,
                  lotCharge: lotResult.lotCharge,
                  techFee: lotResult.techFee,
                  subTotal: lotResult.subTotal,
                  envFee: lotResult.envFee,
                  grandTotal: grandTotalFinal,
                  leadTime: customer?.leadTime ?? '',
                  deliveryFee: customer?.deliveryFee ?? '',
                  standard,
                  rushLevel,
                  rushSurcharge,
                })}>
                  <Printer className="h-3 w-3" /> Print
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1.5" disabled={saving}
                  onClick={handleSave}>
                  {saving ? 'Saving...' : <><Save className="h-3 w-3" /> Save Quote</>}
                </Button>
              </div>

              {/* Save result */}
              {savedQuote && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full font-mono font-medium border border-green-200">
                    {savedQuote.quoteNumber}
                  </span>
                  <Link to="/quotes" className="flex items-center gap-1 text-blue-600 hover:underline">
                    View in Quote History <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
              {saveError && (
                <p className="mt-2 text-xs text-destructive">{saveError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Calculation Trace Viewer */}
        {calcResult?.trace && (
          <Card>
            <CardHeader className="pb-2">
              <button
                onClick={() => setShowTrace(!showTrace)}
                className="flex items-center gap-2 text-sm font-medium w-full text-left"
              >
                {showTrace ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Calculation Trace ({calcResult.trace.steps.length} steps)
              </button>
            </CardHeader>
            {showTrace && (
              <CardContent>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {calcResult.trace.steps.map((step: TraceStep) => (
                    <div key={step.stepIndex} className="flex items-start gap-2 text-xs py-1 border-b border-dashed last:border-0">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                        {step.ruleCategory}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold text-primary">{step.ruleName}</span>
                          <span className="text-muted-foreground">=</span>
                          <span className="font-mono truncate text-muted-foreground" title={step.expression}>
                            {step.expression}
                          </span>
                        </div>
                        {Object.keys(step.namedInputs).length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {Object.entries(step.namedInputs)
                              .filter(([, v]) => typeof v === 'number')
                              .slice(0, 4)
                              .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(4) : v}`)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="font-mono font-bold shrink-0">
                        {typeof step.result === 'number' ? step.result.toFixed(4) : step.result}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
