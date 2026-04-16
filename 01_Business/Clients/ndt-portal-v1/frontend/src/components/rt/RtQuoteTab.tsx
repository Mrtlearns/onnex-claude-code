import { useState, useMemo, useCallback } from 'react'
import { quotesApi } from '@/lib/quotesApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Printer, Search, Save, Check } from 'lucide-react'
import type { RtSettings, RtFilmSize, RtFilmSizeComputed, RtPricingTier, RtRates } from '@/lib/rt/types'
import { useRtQuotes, useRtViewRows } from '@/lib/rt/hooks/useRtQuote'
import { computeViewRow, computeQuoteTotals, computeTierResults, fmt } from '@/lib/rt/calculations'
import { printRtQuote } from '@/lib/printQuote'

interface Props {
  rates: RtRates
  filmSizes: RtFilmSize[]
  filmSizeMap: Map<string, RtFilmSizeComputed>
  tiers: RtPricingTier[]
  settings: RtSettings
}

const SHOT_LABELS = ['0-shot', 'Single', 'Double', 'Triple']

export default function RtQuoteTab({ rates, filmSizes, filmSizeMap, tiers, settings }: Props) {
  const { quotes, create: createQuote, remove: removeQuote } = useRtQuotes()
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)
  const [activeTierId, setActiveTierId] = useState<string>('')
  const [newPart, setNewPart] = useState({ partNumber: '', customerName: '' })
  const [filterPart, setFilterPart] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const { rows, addRow, updateRow, removeRow } = useRtViewRows(activeQuoteId)

  const activeTier = tiers.find(t => t.id === activeTierId) ?? tiers[0]

  const viewCalcs = useMemo(() => {
    if (!activeTier) return []
    return rows.map(r => computeViewRow(r, rates, filmSizeMap, activeTier))
  }, [rows, rates, filmSizeMap, activeTier])

  const totals = useMemo(() => computeQuoteTotals(viewCalcs), [viewCalcs])

  const tierResults = useMemo(() => {
    if (tiers.length === 0) return []
    return computeTierResults(tiers, rows, filmSizeMap, rates, settings)
  }, [tiers, rows, filmSizeMap, rates, settings])

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const partMatch = !filterPart || q.partNumber.toLowerCase().includes(filterPart.toLowerCase())
      const custMatch = !filterCustomer || q.customerName.toLowerCase().includes(filterCustomer.toLowerCase())
      return partMatch && custMatch
    })
  }, [quotes, filterPart, filterCustomer])

  const handleCreateQuote = useCallback(async () => {
    if (!newPart.partNumber || !newPart.customerName) return
    const q = await createQuote(newPart)
    setActiveQuoteId(q.id)
    setNewPart({ partNumber: '', customerName: '' })
    setShowCreateForm(false)
  }, [newPart, createQuote])

  const handleAddRow = useCallback(async () => {
    if (!activeQuoteId || rows.length >= 50) return
    await addRow({
      quoteId: activeQuoteId,
      viewNumber: rows.length + 1,
      shotType: 1,
      qtyPartsPerFilm: 2,
      filmSizeId: filmSizes[4]?.id ?? filmSizes[0]?.id,
      unpackLoadTime: 1.0,
      darkroomSortTime: 1.0,
      shotTime: 2.0,
      readTime: 1.0,
      sortOrder: rows.length,
    })
  }, [activeQuoteId, rows.length, addRow, filmSizes])

  const activeQuote = quotes.find(q => q.id === activeQuoteId)

  const handleSaveQuote = useCallback(async () => {
    if (!activeQuote || rows.length === 0) return
    setSaving(true)
    setSavedId(null)
    try {
      const body = {
        partNumber: activeQuote.partNumber,
        customerName: activeQuote.customerName,
        pricingTierId: activeTierId || tiers[0]?.id,
        source: 'portal',
        views: rows.map(r => ({
          viewNumber: r.viewNumber,
          shotType: r.shotType,
          qtyPartsPerFilm: r.qtyPartsPerFilm,
          filmSizeId: r.filmSizeId,
          unpackLoadTime: r.unpackLoadTime,
          darkroomSortTime: r.darkroomSortTime,
          shotTime: r.shotTime,
          readTime: r.readTime,
        })),
      }
      const data = await quotesApi.calculateRt(body)
      if (data.quoteId) {
        setSavedId(data.quoteId)
        setTimeout(() => setSavedId(null), 4000)
      }
    } finally {
      setSaving(false)
    }
  }, [activeQuote, rows, activeTierId, tiers])

  return (
    <div className="space-y-6">
      {/* Quote selector */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Quotes</CardTitle>
          <Button size="sm" onClick={() => setShowCreateForm(v => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1" />New Quote
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Create form — shown only when toggled */}
          {showCreateForm && (
            <div className="flex gap-2 items-end p-3 rounded-md border bg-muted/30">
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">Part Number *</Label>
                <Input
                  placeholder="e.g. PN-001"
                  value={newPart.partNumber}
                  onChange={e => setNewPart(p => ({ ...p, partNumber: e.target.value }))}
                  className="h-8 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleCreateQuote()}
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">Customer Name *</Label>
                <Input
                  placeholder="e.g. ACME Corp"
                  value={newPart.customerName}
                  onChange={e => setNewPart(p => ({ ...p, customerName: e.target.value }))}
                  className="h-8 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleCreateQuote()}
                />
              </div>
              <Button size="sm" onClick={handleCreateQuote} disabled={!newPart.partNumber || !newPart.customerName}>
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreateForm(false); setNewPart({ partNumber: '', customerName: '' }) }}>
                Cancel
              </Button>
            </div>
          )}

          {/* Filter row */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter by part number…"
                value={filterPart}
                onChange={e => setFilterPart(e.target.value)}
                className="h-8 text-sm pl-8"
              />
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter by customer…"
                value={filterCustomer}
                onChange={e => setFilterCustomer(e.target.value)}
                className="h-8 text-sm pl-8"
              />
            </div>
            {(filterPart || filterCustomer) && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => { setFilterPart(''); setFilterCustomer('') }}>
                Clear
              </Button>
            )}
          </div>

          {/* Quotes table */}
          {quotes.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No quotes yet — click New Quote to create one</p>
          ) : filteredQuotes.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No quotes match the current filter</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2">Part Number</th>
                    <th className="text-left px-3 py-2">Customer</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map(q => (
                    <tr
                      key={q.id}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${q.id === activeQuoteId ? 'bg-primary/10' : 'hover:bg-muted/30'}`}
                      onClick={() => setActiveQuoteId(q.id)}
                    >
                      <td className="px-3 py-2 font-medium">
                        {q.partNumber}
                        {q.id === activeQuoteId && <Badge variant="secondary" className="ml-2 text-xs py-0">active</Badge>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{q.customerName}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={e => { e.stopPropagation(); removeQuote(q.id); if (activeQuoteId === q.id) setActiveQuoteId(null) }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {activeQuote && (
        <>
          {/* Pricing tier selector */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium whitespace-nowrap">Active Tier:</Label>
            <Select value={activeTierId || tiers[0]?.id} onValueChange={setActiveTierId}>
              <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* View rows table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">View Rows — {activeQuote.partNumber}</CardTitle>
              <Button size="sm" onClick={handleAddRow}><Plus className="h-3.5 w-3.5 mr-1" />Add View</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-2 w-8">#</th>
                    <th className="text-left py-2 pr-2">Shot</th>
                    <th className="text-left py-2 pr-2">Qty/Film</th>
                    <th className="text-left py-2 pr-2">Film Size</th>
                    <th className="text-left py-2 pr-2">Load</th>
                    <th className="text-left py-2 pr-2">DR Sort</th>
                    <th className="text-left py-2 pr-2">Shot Time</th>
                    <th className="text-left py-2 pr-2">Read</th>
                    <th className="text-left py-2 pr-2 text-right">Labor</th>
                    <th className="text-left py-2 pr-2 text-right">Film</th>
                    <th className="text-left py-2 text-right">Total</th>
                    <th className="py-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const calc = viewCalcs[i]
                      return (
                        <tr key={row.id} className="border-b last:border-0 align-middle">
                          <td className="py-1.5 pr-2 text-muted-foreground">{row.viewNumber}</td>
                          <td className="py-1.5 pr-2">
                            <Select value={String(row.shotType)} onValueChange={v => updateRow(row.id, { shotType: parseInt(v) as 0|1|2|3 })}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{SHOT_LABELS.map((l, idx) => <SelectItem key={idx} value={String(idx)}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input type="number" min={1} defaultValue={row.qtyPartsPerFilm} onBlur={e => updateRow(row.id, { qtyPartsPerFilm: parseInt(e.target.value) })} className="h-7 w-16 text-xs" />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Select value={row.filmSizeId} onValueChange={v => updateRow(row.id, { filmSizeId: v })}>
                              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{filmSizes.map(fs => <SelectItem key={fs.id} value={fs.id}>{fs.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          {(['unpackLoadTime','darkroomSortTime','shotTime','readTime'] as const).map(field => (
                            <td key={field} className="py-1.5 pr-2">
                              <Input type="number" step="0.5" min={0} defaultValue={row[field]} onBlur={e => updateRow(row.id, { [field]: parseFloat(e.target.value) })} className="h-7 w-16 text-xs" />
                            </td>
                          ))}
                          <td className="py-1.5 pr-2 text-right text-xs text-muted-foreground italic">{calc ? fmt(calc.laborCost) : '—'}</td>
                          <td className="py-1.5 pr-2 text-right text-xs text-muted-foreground italic">{calc ? fmt(calc.filmCostPerPart) : '—'}</td>
                          <td className="py-1.5 text-right font-medium text-xs">{calc ? fmt(calc.pricePerView) : '—'}</td>
                          <td className="py-1.5 pl-2">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRow(row.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot><tr className="border-t font-semibold text-sm bg-muted/30">
                      <td colSpan={8} className="py-2 text-right pr-2 text-muted-foreground text-xs">Totals</td>
                      <td className="py-2 pr-2 text-right">{fmt(totals.totalLabor)}</td>
                      <td className="py-2 pr-2 text-right">{fmt(totals.totalFilm)}</td>
                      <td className="py-2 text-right">{fmt(totals.totalPrice)}</td>
                      <td></td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
              {rows.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No view rows yet — click Add View</p>}
            </CardContent>
          </Card>

          {/* Tier results */}
          {tierResults.length > 0 && rows.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Pricing Tier Comparison</CardTitle>
                <div className="flex gap-2">
                  {savedId && (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Check className="h-3 w-3" />Saved to history
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    disabled={saving || rows.length === 0}
                    onClick={handleSaveQuote}
                  >
                    <Save className="h-3 w-3" />{saving ? 'Saving…' : 'Save Quote'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => printRtQuote({
                  partNumber: activeQuote?.partNumber ?? '',
                  customerName: activeQuote?.customerName ?? '',
                  tierLabel: activeTier?.label ?? '',
                  views: rows.map((row, i) => ({
                    viewNumber: row.viewNumber,
                    shotLabel: SHOT_LABELS[row.shotType],
                    qtyPerFilm: row.qtyPartsPerFilm,
                    filmLabel: filmSizes.find(f => f.id === row.filmSizeId)?.label ?? '',
                    unpackLoad: row.unpackLoadTime,
                    darkroomSort: row.darkroomSortTime,
                    shotTime: row.shotTime,
                    readTime: row.readTime,
                    laborCost: viewCalcs[i]?.laborCost ?? 0,
                    filmCost: viewCalcs[i]?.filmCostPerPart ?? 0,
                    pricePerView: viewCalcs[i]?.pricePerView ?? 0,
                  })),
                  totalLabor: totals.totalLabor,
                  totalFilm: totals.totalFilm,
                  totalPrice: totals.totalPrice,
                  tiers: tierResults.map(t => ({
                    label: t.label,
                    filmTotal: t.filmTotal,
                    grandTotal: t.grandTotal,
                    isActive: t.id === activeTierId,
                  })),
                })}>
                  <Printer className="h-3 w-3" /> Print
                </Button>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4">Tier</th>
                    <th className="text-right py-2 pr-4">Film Total</th>
                    <th className="text-right py-2">Grand Total</th>
                  </tr></thead>
                  <tbody>
                    {tierResults.map(tr => (
                      <tr key={tr.id} className={`border-b last:border-0 ${tr.id === activeTierId ? 'bg-primary/5 font-semibold' : ''}`}>
                        <td className="py-2 pr-4">{tr.label} {tr.id === activeTierId && <Badge variant="outline" className="ml-2 text-xs">active</Badge>}</td>
                        <td className="py-2 pr-4 text-right">{fmt(tr.filmTotal)}</td>
                        <td className="py-2 text-right">{fmt(tr.grandTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
