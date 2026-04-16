import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UtSettings } from '@/lib/ut/types'

interface Props { settings: UtSettings; onUpdate: (c: Partial<UtSettings>) => void }

function NumField({ label, value, onBlur, step = 'any' }: { label: string; value: number|string; onBlur: (v: string) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={typeof value === 'number' ? 'number' : 'text'} step={step} defaultValue={value} onBlur={e => onBlur(e.target.value)} className="h-8 text-sm" />
    </div>
  )
}

export default function UtSettingsTab({ settings, onUpdate }: Props) {
  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-base">Global Settings</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <NumField label="Default Hourly Rate" value={settings.defaultHourlyRate} onBlur={v => onUpdate({ defaultHourlyRate: parseFloat(v) })} />
        <NumField label="C-Scan Hourly Rate" value={settings.cScanHourlyRate} onBlur={v => onUpdate({ cScanHourlyRate: parseFloat(v) })} />
        <NumField label="High-Res Rate" value={settings.highResHourlyRate} onBlur={v => onUpdate({ highResHourlyRate: parseFloat(v) })} />
        <NumField label="Default Min Charge" value={settings.defaultMinCharge} onBlur={v => onUpdate({ defaultMinCharge: parseFloat(v) })} />
        <NumField label="Technique Fee ($)" value={settings.defaultTechniqueFee} onBlur={v => onUpdate({ defaultTechniqueFee: parseFloat(v) })} />
        <NumField label="Env Fee Rate" value={settings.defaultEnvFeeRate} onBlur={v => onUpdate({ defaultEnvFeeRate: parseFloat(v) })} step="0.001" />
        <NumField label="Default Load Time (min)" value={settings.defaultLoadTime} onBlur={v => onUpdate({ defaultLoadTime: parseFloat(v) })} />
        <NumField label="Scan Speed Divisor" value={settings.scanSpeedDivisor} onBlur={v => onUpdate({ scanSpeedDivisor: parseFloat(v) })} />
        <NumField label="Default Lead Time" value={settings.defaultLeadTime} onBlur={v => onUpdate({ defaultLeadTime: v })} />
      </CardContent>
    </Card>
  )
}
