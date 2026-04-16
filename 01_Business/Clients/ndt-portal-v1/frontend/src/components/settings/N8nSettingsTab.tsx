import { Save, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'

export interface N8nSettings {
  webhookBaseUrl: string
  webhookToken: string
  quoteWebhookPath: string
  loginEmail: string
  loginPassword: string
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
  n8n: N8nSettings
  onChange: (n8n: N8nSettings) => void
  onSave: () => void
  portalUrl: string
  savedBadge?: React.ReactNode
}

export default function N8nSettingsTab({ n8n, onChange, onSave, portalUrl, savedBadge }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" /> n8n Automation
            </CardTitle>
            <CardDescription className="mt-1">
              n8n runs embedded in this portal — access it via the{' '}
              <a href="/tools" className="underline text-primary">Tools page</a>.
              Configure the shared secret below so n8n workflows can call back into the quote API.
            </CardDescription>
          </div>
          {savedBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-900/10 px-3 py-2.5 space-y-3">
          <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">Portal Auto-Login</p>
          <p className="text-xs text-orange-700 dark:text-orange-400">
            Save your n8n login credentials here. When you open the Tools → n8n page, the portal will auto-fill and submit the login form for you.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="n8n Login Email" id="n8n-login-email" type="email" value={n8n.loginEmail} placeholder="admin@example.com" onChange={v => onChange({ ...n8n, loginEmail: v })} />
            <Field label="n8n Login Password" id="n8n-login-password" type="password" value={n8n.loginPassword} placeholder="••••••••" onChange={v => onChange({ ...n8n, loginPassword: v })} />
          </div>
        </div>
        <Field label="n8n Base URL" id="n8n-base-url" value={n8n.webhookBaseUrl} placeholder="/n8n" hint="Base path of the embedded n8n instance — default /n8n (served internally via Traefik)" onChange={v => onChange({ ...n8n, webhookBaseUrl: v })} />
        <Field label="Webhook Token" id="n8n-token" type="password" value={n8n.webhookToken} placeholder="••••••••" hint="N8N_WEBHOOK_SECRET — bearer token set in n8n HTTP Request node header X-N8N-Token" onChange={v => onChange({ ...n8n, webhookToken: v })} />
        <Field label="Quote Webhook Path" id="n8n-path" value={n8n.quoteWebhookPath} placeholder="/webhook/quote" hint="Path appended to base URL for incoming quote requests from n8n" onChange={v => onChange({ ...n8n, quoteWebhookPath: v })} />
        <div className="pt-2 border-t">
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">n8n HTTP Request node config:</p>
            <p><strong>Method:</strong> POST</p>
            <p><strong>URL:</strong> <code>{portalUrl}/api/ut/integrations/n8n/quote</code></p>
            <p><strong>Auth header:</strong> <code>X-N8N-Token: &lt;token above&gt;</code></p>
            <p><strong>Body:</strong> standard <code>UtQuoteRequest</code> JSON</p>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Save n8n Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
