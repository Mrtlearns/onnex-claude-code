import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Rule } from '@/lib/ut/types-rules'

interface Props {
  rules: Rule[]
  onChange: (rules: Rule[]) => void
  readOnly: boolean
}

interface FormulaStep {
  name: string
  expr: string
  condition?: string
}

export default function GridEditor({ rules, onChange, readOnly }: Props) {
  function updateCellExpr(ruleIdx: number, stepIdx: number, value: string) {
    const updated = [...rules]
    const rule = { ...updated[ruleIdx] }
    const def = { ...rule.definition } as Record<string, unknown>
    const steps = [...((def.steps as FormulaStep[]) ?? [])]
    steps[stepIdx] = { ...steps[stepIdx], expr: value }
    rule.definition = { ...def, steps } as Rule['definition']
    updated[ruleIdx] = rule
    onChange(updated)
  }

  // Flatten all formula rules into rows for the grid
  const formulaRules = rules
    .map((r, idx) => ({ rule: r, ruleIdx: idx }))
    .filter(({ rule }) => rule.definition.type === 'formula')

  return (
    <Card>
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-sm">Spreadsheet View</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium w-24">Category</th>
                <th className="px-3 py-2 text-left font-medium w-28">Geometry</th>
                <th className="px-3 py-2 text-left font-medium w-28">Step</th>
                <th className="px-3 py-2 text-left font-medium">Expression</th>
              </tr>
            </thead>
            <tbody>
              {formulaRules.map(({ rule, ruleIdx }) => {
                const steps = ((rule.definition as Record<string, unknown>).steps as FormulaStep[]) ?? []
                return steps.map((step, stepIdx) => (
                  <tr key={`${rule.id}-${stepIdx}`} className="border-b hover:bg-muted/30">
                    {stepIdx === 0 && (
                      <>
                        <td className="px-3 py-1.5" rowSpan={steps.length}>
                          <Badge variant="outline" className="text-[10px]">{rule.category}</Badge>
                        </td>
                        <td className="px-3 py-1.5 font-mono" rowSpan={steps.length}>
                          {rule.geometry_type ?? 'all'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-1.5 font-mono font-semibold text-primary">
                      {step.name}
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        className="w-full px-2 py-1 font-mono text-xs border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary rounded"
                        value={step.expr}
                        onChange={e => updateCellExpr(ruleIdx, stepIdx, e.target.value)}
                        disabled={readOnly}
                      />
                    </td>
                  </tr>
                ))
              })}

              {/* Lookup rules */}
              {rules
                .filter(r => r.definition.type === 'lookup')
                .map(rule => {
                  const table = (rule.definition as Record<string, unknown>).table as Record<string, unknown>
                  const entries = Object.entries(table)
                  return entries.map(([key, val], i) => (
                    <tr key={`${rule.id}-${key}`} className="border-b hover:bg-muted/30">
                      {i === 0 && (
                        <>
                          <td className="px-3 py-1.5" rowSpan={entries.length}>
                            <Badge variant="outline" className="text-[10px]">{rule.category}</Badge>
                          </td>
                          <td className="px-3 py-1.5 font-mono" rowSpan={entries.length}>all</td>
                        </>
                      )}
                      <td className="px-3 py-1.5 font-mono">{key}</td>
                      <td className="px-3 py-1.5">
                        {typeof val === 'object' && val !== null && 'source' in (val as Record<string, unknown>) ? (
                          <span
                            title="Named variable reference — edit in Named Variables panel"
                            className="font-mono text-[11px] text-blue-300 border border-dashed border-blue-400/50 bg-blue-950/20 rounded px-1.5 py-0.5"
                          >
                            {(val as Record<string, unknown>).source as string}
                          </span>
                        ) : (
                          <span className="font-mono text-muted-foreground">
                            {typeof val === 'object' && val !== null
                              ? JSON.stringify(val)
                              : String(val)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
