import { Save, Cloud } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'

export interface SalesforceSettings {
  instanceUrl: string
  clientId: string
  clientSecret: string
  username: string
  password: string
  webhookSecret: string
}

function Field({
  label, id, type = 'text', value, placeholder, hint, onChange,
}: {
  label: string; id: string; type?: string; value: string
  placeholder?: string; hint?: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} autoComplete="off" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

interface Props {
  sf: SalesforceSettings
  onChange: (sf: SalesforceSettings) => void
  onSave: () => void
  savedBadge?: React.ReactNode
}

export default function SalesforceSettingsTab({ sf, onChange, onSave, savedBadge }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-blue-500" /> Salesforce
            </CardTitle>
            <CardDescription className="mt-1">
              OAuth2 credentials for writing quote data back to Salesforce Opportunities.
              Uses the username–password flow via the Connected App.
            </CardDescription>
          </div>
          {savedBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Instance URL" id="sf-instance" value={sf.instanceUrl} placeholder="https://yourorg.my.salesforce.com" hint="SF_INSTANCE_URL — your Salesforce org domain" onChange={v => onChange({ ...sf, instanceUrl: v })} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Client ID (Consumer Key)" id="sf-client-id" value={sf.clientId} placeholder="3MVG9..." hint="SF_CLIENT_ID — from the Connected App" onChange={v => onChange({ ...sf, clientId: v })} />
          <Field label="Client Secret" id="sf-client-secret" type="password" value={sf.clientSecret} placeholder="••••••••" hint="SF_CLIENT_SECRET" onChange={v => onChange({ ...sf, clientSecret: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="API Username" id="sf-username" value={sf.username} placeholder="api.service@yourorg.com" hint="SF_USERNAME — API service account" onChange={v => onChange({ ...sf, username: v })} />
          <Field label="Password + Security Token" id="sf-password" type="password" value={sf.password} placeholder="••••••••" hint="SF_PASSWORD — password concatenated with security token" onChange={v => onChange({ ...sf, password: v })} />
        </div>
        <Field label="Webhook Secret (HMAC)" id="sf-webhook-secret" type="password" value={sf.webhookSecret} placeholder="••••••••" hint="SF_WEBHOOK_SECRET — used to verify inbound webhook signatures from Salesforce Flow" onChange={v => onChange({ ...sf, webhookSecret: v })} />
        <div className="pt-2 border-t">
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Salesforce fields written on quote generation:</p>
            <p><code>NDT_Quote_Number__c</code> — quote number (Text)</p>
            <p><code>NDT_Quote_Total__c</code> — grand total (Currency)</p>
            <p><code>NDT_Quote_Status__c</code> — lifecycle status (Picklist)</p>
            <p><code>NDT_Quote_Date__c</code> — generated timestamp (DateTime)</p>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Save Salesforce Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
