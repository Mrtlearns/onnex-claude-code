import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Loader2, RotateCcw } from 'lucide-react'
import type { UtCustomer } from '@/lib/ut/types'
import { createRuleSetForCustomer, assignRuleSet, fetchRuleSets } from '@/lib/ut/rulesApi'
import type { RuleSet } from '@/lib/ut/types-rules'

interface Props {
  customers: UtCustomer[]
  onUpdate: (id: string, c: Partial<UtCustomer>) => void
  onCreate: (c: Partial<UtCustomer>) => void
  onSwitchToRules?: (ruleSetId: string) => void
}

function NumInput({ label, value, onBlur }: { label: string; value: number; onBlur: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="any" defaultValue={value} onBlur={e => onBlur(parseFloat(e.target.value))} className="h-8 text-sm" />
    </div>
  )
}

export default function UtCustomersTab({ customers, onUpdate, onSwitchToRules }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UtCustomer | null>(null)
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([])
  const [creating, setCreating] = useState(false)

  // Load rule sets on mount to show assignments
  useEffect(() => {
    fetchRuleSets().then(setRuleSets).catch(console.error)
  }, [])

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  function getRuleSetName(customerId: string): string {
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return 'default'
    // Check if customer has a rule_set_id by looking at the raw data
    // Since UtCustomer type may not have rule_set_id, we check ruleSets
    const rs = ruleSets.find(r => r.name === customer.name)
    return rs ? rs.name : 'default'
  }

  function getCustomerRuleSet(customer: UtCustomer): RuleSet | null {
    return ruleSets.find(r => r.name === customer.name) ?? null
  }

  async function handleCustomizeRules(customer: UtCustomer) {
    setCreating(true)
    try {
      const result = await createRuleSetForCustomer(customer.id)
      // Refresh rule sets list
      const updated = await fetchRuleSets()
      setRuleSets(updated)
      // Switch to Rules tab with this rule set selected
      if (onSwitchToRules) onSwitchToRules(result.id)
    } catch (e) {
      console.error('Failed to create customer rule set:', e)
    } finally {
      setCreating(false)
    }
  }

  async function handleResetToDefault(customer: UtCustomer) {
    try {
      await assignRuleSet(customer.id, null)
      const updated = await fetchRuleSets()
      setRuleSets(updated)
    } catch (e) {
      console.error('Failed to reset rule set:', e)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customers ({customers.length})</CardTitle>
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm mt-2" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.map(c => {
              const customRs = getCustomerRuleSet(c)
              return (
                <button key={c.id} onClick={() => setSelected(c)}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b last:border-0 flex items-center justify-between hover:bg-muted transition-colors ${selected?.id === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                  <div className="flex flex-col">
                    <span className={c.isActive ? '' : 'text-muted-foreground line-through'}>{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {customRs ? `Rules: ${customRs.name} v${customRs.latest_version}` : 'Rules: default'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs ml-2">${c.hourlyRate}/hr</Badge>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        {selected ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selected.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rule Set Assignment */}
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">Calculation Rule Set</Label>
                    {(() => {
                      const customRs = getCustomerRuleSet(selected)
                      return customRs ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="default" className="text-xs">{customRs.name} v{customRs.latest_version}</Badge>
                          <button
                            onClick={() => onSwitchToRules?.(customRs.id)}
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            <BookOpen className="h-2.5 w-2.5" /> Edit Rules
                          </button>
                          <button
                            onClick={() => handleResetToDefault(selected)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            <RotateCcw className="h-2.5 w-2.5" /> Reset to default
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">default</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] gap-1"
                            disabled={creating}
                            onClick={() => handleCustomizeRules(selected)}
                          >
                            {creating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <BookOpen className="h-2.5 w-2.5" />}
                            Customize Rules
                          </Button>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Existing rate fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <NumInput label="Hourly Rate ($/hr)" value={selected.hourlyRate} onBlur={v => { onUpdate(selected.id, { hourlyRate: v }); setSelected(s => s ? {...s, hourlyRate: v} : s) }} />
                <NumInput label="C-Scan Rate ($/hr)" value={selected.cScanRate} onBlur={v => { onUpdate(selected.id, { cScanRate: v }); setSelected(s => s ? {...s, cScanRate: v} : s) }} />
                <NumInput label="Min Charge ($)" value={selected.minCharge} onBlur={v => { onUpdate(selected.id, { minCharge: v }); setSelected(s => s ? {...s, minCharge: v} : s) }} />
                <NumInput label="C-Scan Min ($)" value={selected.cScanMinCharge} onBlur={v => { onUpdate(selected.id, { cScanMinCharge: v }); setSelected(s => s ? {...s, cScanMinCharge: v} : s) }} />
                <NumInput label="Technique Fee ($)" value={selected.techniqueFee} onBlur={v => { onUpdate(selected.id, { techniqueFee: v }); setSelected(s => s ? {...s, techniqueFee: v} : s) }} />
                <NumInput label="Env Fee Rate" value={selected.envFeeRate} onBlur={v => { onUpdate(selected.id, { envFeeRate: v }); setSelected(s => s ? {...s, envFeeRate: v} : s) }} />
              </div>
              <div className="flex gap-6 flex-wrap">
                <div className="flex items-center gap-2"><Switch checked={selected.hasEnvFee} onCheckedChange={v => { onUpdate(selected.id, { hasEnvFee: v }); setSelected(s => s ? {...s, hasEnvFee: v} : s) }} /><Label className="text-sm">Env Fee</Label></div>
                <div className="flex items-center gap-2"><Switch checked={selected.hasTechFee} onCheckedChange={v => { onUpdate(selected.id, { hasTechFee: v }); setSelected(s => s ? {...s, hasTechFee: v} : s) }} /><Label className="text-sm">Tech Fee</Label></div>
                <div className="flex items-center gap-2"><Switch checked={selected.isActive} onCheckedChange={v => { onUpdate(selected.id, { isActive: v }); setSelected(s => s ? {...s, isActive: v} : s) }} /><Label className="text-sm">Active</Label></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Delivery Fee</Label>
                  <Input defaultValue={selected.deliveryFee} onBlur={e => onUpdate(selected.id, { deliveryFee: e.target.value })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lead Time</Label>
                  <Input defaultValue={selected.leadTime} onBlur={e => onUpdate(selected.id, { leadTime: e.target.value })} className="h-8 text-sm" />
                </div>
              </div>
              {selected.notes && <p className="text-xs text-muted-foreground italic">{selected.notes}</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">Select a customer to edit</div>
        )}
      </div>
    </div>
  )
}
