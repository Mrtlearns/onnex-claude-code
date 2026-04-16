import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Rule } from '@/lib/ut/types-rules'

interface Props {
  rules: Rule[]
  onChange: (rules: Rule[]) => void
  readOnly: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  rate: 'Rate Lookup',
  load_time: 'Load Time Defaults',
  scan_formula: 'Scan Formulas',
  price_modifier: 'Price Modifiers',
  weight_formula: 'Weight Formula',
  lot_calculation: 'Lot Calculation',
  rounding: 'Rounding Function',
}

const CATEGORY_ORDER = ['rate', 'load_time', 'scan_formula', 'price_modifier', 'weight_formula', 'lot_calculation', 'rounding']

interface FormulaStep {
  name: string
  expr: string
  condition?: string
}

export default function TableFormEditor({ rules, onChange, readOnly }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Group rules by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    rules: rules.filter(r => r.category === cat),
  })).filter(g => g.rules.length > 0)

  function updateRule(ruleId: string, updater: (r: Rule) => Rule) {
    onChange(rules.map(r => r.id === ruleId ? updater({ ...r }) : r))
  }

  function updateStepExpr(ruleId: string, stepIndex: number, newExpr: string) {
    updateRule(ruleId, r => {
      const def = { ...r.definition } as Record<string, unknown>
      const steps = [...((def.steps as FormulaStep[]) ?? [])]
      steps[stepIndex] = { ...steps[stepIndex], expr: newExpr }
      return { ...r, definition: { ...def, steps } as Rule['definition'] }
    })
  }

  function updateLookupValue(ruleId: string, key: string, value: string) {
    updateRule(ruleId, r => {
      const def = { ...r.definition } as Record<string, unknown>
      const table = { ...((def.table as Record<string, unknown>) ?? {}) }
      // Try to parse as number, otherwise store as object
      const numVal = Number(value)
      table[key] = isNaN(numVal) ? { source: value } : numVal
      return { ...r, definition: { ...def, table } as Rule['definition'] }
    })
  }

  function toggleCategory(cat: string) {
    setCollapsed(c => ({ ...c, [cat]: !c[cat] }))
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ category, label, rules: catRules }) => (
        <Card key={category}>
          <CardHeader className="py-2 px-4 cursor-pointer" onClick={() => toggleCategory(category)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {collapsed[category] ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                {label}
                <Badge variant="outline" className="text-[10px]">{catRules.length} rule{catRules.length > 1 ? 's' : ''}</Badge>
              </CardTitle>
            </div>
          </CardHeader>

          {!collapsed[category] && (
            <CardContent className="pt-0 space-y-4">
              {catRules.map(rule => (
                <div key={rule.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold">{rule.label}</span>
                    {rule.geometry_type && (
                      <Badge variant="secondary" className="text-[10px]">{rule.geometry_type}</Badge>
                    )}
                  </div>

                  {rule.description && (
                    <p className="text-[10px] text-muted-foreground mb-2">{rule.description}</p>
                  )}

                  {/* Lookup table rendering */}
                  {rule.definition.type === 'lookup' && (
                    <div className="space-y-1">
                      {Object.entries((rule.definition as Record<string, unknown>).table as Record<string, unknown>).map(([key, val]) => {
                        const isSourceRef = typeof val === 'object' && val !== null && 'source' in (val as Record<string, unknown>)
                        const sourceVar = isSourceRef ? (val as Record<string, unknown>).source as string : null
                        const literalValue = typeof val === 'number'
                          ? val
                          : (typeof val === 'object' && val !== null && 'value' in (val as Record<string, unknown>)
                            ? (val as Record<string, unknown>).value as string | number
                            : null)
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <Label className="text-xs w-28 shrink-0 font-mono">{key}</Label>
                            {isSourceRef ? (
                              <div
                                title="Named variable reference — edit in Named Variables panel"
                                className="h-6 flex items-center px-2 flex-1 rounded border border-dashed border-blue-400/50 bg-blue-950/20 text-[11px] font-mono text-blue-300 cursor-default select-none"
                              >
                                {sourceVar}
                              </div>
                            ) : (
                              <Input
                                className="h-6 text-xs font-mono"
                                value={String(literalValue ?? '')}
                                onChange={e => updateLookupValue(rule.id, key, e.target.value)}
                                disabled={readOnly}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Formula steps rendering */}
                  {rule.definition.type === 'formula' && (
                    <div className="space-y-1">
                      {((rule.definition as Record<string, unknown>).steps as FormulaStep[] ?? []).map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Label className="text-xs w-32 shrink-0 font-mono text-primary">{step.name}</Label>
                          {step.condition && (
                            <Badge variant="outline" className="text-[9px] shrink-0">{step.condition}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">=</span>
                          <Input
                            className="h-6 text-xs font-mono flex-1"
                            value={step.expr}
                            onChange={e => updateStepExpr(rule.id, i, e.target.value)}
                            disabled={readOnly}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Function rendering */}
                  {rule.definition.type === 'function' && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-28 shrink-0 font-mono">
                        {(rule.definition as Record<string, unknown>).name as string}(n)
                      </Label>
                      <span className="text-xs text-muted-foreground">=</span>
                      <Input
                        className="h-6 text-xs font-mono flex-1"
                        value={(rule.definition as Record<string, unknown>).expr as string}
                        onChange={e => updateRule(rule.id, r => ({
                          ...r,
                          definition: { ...r.definition, expr: e.target.value } as Rule['definition'],
                        }))}
                        disabled={readOnly}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
