import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { RtSettings, RtOperator } from '@/lib/rt/types'

interface Props {
  settings: RtSettings
  operators: RtOperator[]
  onUpdateSettings: (c: Partial<RtSettings>) => void
  onUpdateOperator: (id: string, c: Partial<RtOperator>) => void
}

function NumField({ label, value, onBlur }: { label: string; value: number; onBlur: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="any" defaultValue={value} onBlur={e => onBlur(parseFloat(e.target.value))} className="h-8 text-sm" />
    </div>
  )
}

const ROLE_COLOR: Record<string, string> = {
  SHOOTER: 'bg-orange-100 text-orange-800',
  DARKROOM_SORT: 'bg-purple-100 text-purple-800',
  READER: 'bg-blue-100 text-blue-800',
}

export default function RtSettingsTab({ settings, operators, onUpdateSettings, onUpdateOperator }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Cost Parameters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <NumField label="Burden Multiplier" value={settings.burdenMultiplier} onBlur={v => onUpdateSettings({ burdenMultiplier: v })} />
          <NumField label="Loaded Rate Multiplier" value={settings.loadedRateMultiplier} onBlur={v => onUpdateSettings({ loadedRateMultiplier: v })} />
          <NumField label="Monthly OH Costs" value={settings.monthlyOhCosts} onBlur={v => onUpdateSettings({ monthlyOhCosts: v })} />
          <NumField label="Monthly Direct Labor" value={settings.monthlyDirectLabor} onBlur={v => onUpdateSettings({ monthlyDirectLabor: v })} />
          <NumField label="Film Markup %" value={settings.filmMarkupPct * 100} onBlur={v => onUpdateSettings({ filmMarkupPct: v / 100 })} />
          <NumField label="Profit Multiplier" value={settings.profitMultiplier} onBlur={v => onUpdateSettings({ profitMultiplier: v })} />
          <NumField label="Misc Profit %" value={settings.miscProfitPct * 100} onBlur={v => onUpdateSettings({ miscProfitPct: v / 100 })} />
          <NumField label="Sales Bonus Mult." value={settings.salesBonusMultiplier} onBlur={v => onUpdateSettings({ salesBonusMultiplier: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Crew Configuration</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <NumField label="Shooter Machine Count" value={settings.shooterMachineCount} onBlur={v => onUpdateSettings({ shooterMachineCount: v })} />
          <NumField label="Shooter Crew Divisor" value={settings.shooterCrewDivisor} onBlur={v => onUpdateSettings({ shooterCrewDivisor: v })} />
          <NumField label="Darkroom Operator Count" value={settings.darkroomOperatorCount} onBlur={v => onUpdateSettings({ darkroomOperatorCount: v })} />
          <NumField label="Reader Crew Count" value={settings.readerCrewCount} onBlur={v => onUpdateSettings({ readerCrewCount: v })} />
          <NumField label="Reader Divisor" value={settings.readerDivisor} onBlur={v => onUpdateSettings({ readerDivisor: v })} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Operators</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Role</th>
                <th className="text-left py-2 pr-4">Base Rate ($/hr)</th>
                <th className="text-left py-2">Active</th>
              </tr></thead>
              <tbody>
                {operators.map(op => (
                  <tr key={op.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{op.name}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[op.role]}`}>{op.role}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <Input type="number" step="0.01" defaultValue={op.baseHourlyRate}
                        onBlur={e => onUpdateOperator(op.id, { baseHourlyRate: parseFloat(e.target.value) })}
                        className="h-7 w-24 text-sm" />
                    </td>
                    <td className="py-2">
                      <Switch checked={op.isActive} onCheckedChange={v => onUpdateOperator(op.id, { isActive: v })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
