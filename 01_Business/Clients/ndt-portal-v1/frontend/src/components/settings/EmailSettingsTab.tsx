import { Save, Mail, Info, Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

export type EmailProvider = 'mailgun' | 'sendgrid' | 'imap'

export interface EmailSettings {
  provider: EmailProvider | ''
  // API-based (Mailgun / SendGrid)
  apiKey: string
  fromAddress: string
  webhookSecret: string
  replyToAddress: string
  // IMAP inbound (Microsoft 365 / Custom)
  imapHost: string
  imapPort: string
  imapSecure: boolean
  imapUser: string
  imapPass: string
  // SMTP outbound (Microsoft 365 / Custom)
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
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
  email: EmailSettings
  onChange: (email: EmailSettings) => void
  onSave: () => void
  savedBadge?: React.ReactNode
}

export default function EmailSettingsTab({ email, onChange, onSave, savedBadge }: Props) {
  const isApi = email.provider === 'mailgun' || email.provider === 'sendgrid'
  const isImap = email.provider === 'imap'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-amber-500" /> Email Integration
            </CardTitle>
            <CardDescription className="mt-1">
              Configure inbound email processing: API-based (Mailgun/SendGrid webhook) or IMAP (Microsoft 365 / custom).
            </CardDescription>
          </div>
          {savedBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selector */}
        <div className="space-y-1.5">
          <Label htmlFor="email-provider">Inbound Email Mode</Label>
          <Select value={email.provider} onValueChange={v => onChange({ ...email, provider: v as EmailProvider | '' })}>
            <SelectTrigger id="email-provider">
              <SelectValue placeholder="Select provider…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mailgun">API-based — Mailgun</SelectItem>
              <SelectItem value="sendgrid">API-based — SendGrid</SelectItem>
              <SelectItem value="imap">IMAP — Microsoft 365 / Custom</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose IMAP to connect a Microsoft 365 mailbox directly via n8n.
          </p>
        </div>

        {/* API-based section */}
        {isApi && (
          <div className="space-y-4">
            <Field label="API Key" id="email-api-key" type="password" value={email.apiKey} placeholder="••••••••" hint="EMAIL_API_KEY — Mailgun private API key or SendGrid API key" onChange={v => onChange({ ...email, apiKey: v })} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="From Address" id="email-from" value={email.fromAddress} placeholder="quotes@onnex.com" hint="EMAIL_FROM — sender address for quote replies" onChange={v => onChange({ ...email, fromAddress: v })} />
              <Field label="Reply-To Address" id="email-reply-to" value={email.replyToAddress} placeholder="ndt@onnex.com" hint="EMAIL_REPLY_TO — optional reply-to override" onChange={v => onChange({ ...email, replyToAddress: v })} />
            </div>
            <Field label="Inbound Webhook Secret" id="email-webhook-secret" type="password" value={email.webhookSecret} placeholder="••••••••" hint="EMAIL_WEBHOOK_SECRET — used to verify inbound webhooks from Mailgun/SendGrid" onChange={v => onChange({ ...email, webhookSecret: v })} />
            <div className="pt-2 border-t">
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Inbound webhook endpoint:</p>
                <p><code>POST /api/ut/integrations/email/quote</code></p>
                <p className="pt-1 font-medium text-foreground">Reply threading:</p>
                <p>The inbound <code>messageId</code> is stored as <code>externalRef</code> so reply emails correctly thread in the customer's mail client.</p>
              </div>
            </div>
          </div>
        )}

        {/* IMAP section */}
        {isImap && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => onChange({
                  ...email,
                  imapHost: 'outlook.office365.com',
                  imapPort: '993',
                  imapSecure: true,
                  smtpHost: 'smtp.office365.com',
                  smtpPort: '587',
                  smtpSecure: false,
                })}
              >
                <Wand2 className="h-3.5 w-3.5" /> Apply Microsoft 365 Defaults
              </Button>
            </div>

            {/* IMAP fields */}
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-3">IMAP — Inbound (n8n Email Trigger)</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="IMAP Host" id="imap-host" value={email.imapHost} placeholder="outlook.office365.com" hint="IMAP_HOST" onChange={v => onChange({ ...email, imapHost: v })} />
                  <Field label="IMAP Port" id="imap-port" value={email.imapPort} placeholder="993" hint="IMAP_PORT — typically 993 for TLS" onChange={v => onChange({ ...email, imapPort: v })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="IMAP Username" id="imap-user" value={email.imapUser} placeholder="user@company.com" hint="IMAP_USER — full email address" onChange={v => onChange({ ...email, imapUser: v })} />
                  <Field label="IMAP Password" id="imap-pass" type="password" value={email.imapPass} placeholder="••••••••" hint="IMAP_PASS — password or app password (if MFA enabled)" onChange={v => onChange({ ...email, imapPass: v })} />
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <Label className="text-sm font-medium">Use TLS (SSL)</Label>
                    <p className="text-xs text-muted-foreground mt-1">Enable for port 993. Required for M365.</p>
                  </div>
                  <Switch checked={email.imapSecure} onCheckedChange={v => onChange({ ...email, imapSecure: v })} />
                </div>
              </div>
            </div>

            {/* SMTP fields */}
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-3">SMTP — Outbound (Quote Reply Emails)</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="SMTP Host" id="smtp-host" value={email.smtpHost} placeholder="smtp.office365.com" hint="SMTP_HOST" onChange={v => onChange({ ...email, smtpHost: v })} />
                  <Field label="SMTP Port" id="smtp-port" value={email.smtpPort} placeholder="587" hint="SMTP_PORT — 587 (STARTTLS) or 465 (SSL)" onChange={v => onChange({ ...email, smtpPort: v })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="SMTP Username" id="smtp-user" value={email.smtpUser} placeholder="user@company.com" hint="SMTP_USER — usually same as IMAP user" onChange={v => onChange({ ...email, smtpUser: v })} />
                  <Field label="SMTP Password" id="smtp-pass" type="password" value={email.smtpPass} placeholder="••••••••" hint="SMTP_PASS" onChange={v => onChange({ ...email, smtpPass: v })} />
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <Label className="text-sm font-medium">Use SSL (Port 465)</Label>
                    <p className="text-xs text-muted-foreground mt-1">Leave OFF for port 587 STARTTLS (M365 default).</p>
                  </div>
                  <Switch checked={email.smtpSecure} onCheckedChange={v => onChange({ ...email, smtpSecure: v })} />
                </div>
              </div>
            </div>

            {/* n8n credential callout */}
            <div className="border-l-4 border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 rounded-r-md px-4 py-3">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-200">n8n Credential Setup Required</p>
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    These settings are stored locally for reference. You <strong>must</strong> enter them manually in n8n → Settings → Credentials → IMAP.
                  </p>
                  <div className="bg-white dark:bg-slate-950 rounded p-2 text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
                    <p><span className="text-slate-500">Name:</span> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">NDT Portal IMAP</code></p>
                    <p><span className="text-slate-500">Host:</span> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{email.imapHost || 'not set'}</code></p>
                    <p><span className="text-slate-500">Port:</span> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{email.imapPort}</code></p>
                    <p><span className="text-slate-500">Secure:</span> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{email.imapSecure ? 'Yes (TLS)' : 'No'}</code></p>
                    <p><span className="text-slate-500">User:</span> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{email.imapUser || 'not set'}</code></p>
                    <p><span className="text-slate-500">Password:</span> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">(enter IMAP_PASS)</code></p>
                  </div>
                  <p className="text-xs text-blue-800 dark:text-blue-300 pt-1">
                    After saving in n8n, activate WF-1 (UT) and WF-2 (RT) workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Save Email Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
