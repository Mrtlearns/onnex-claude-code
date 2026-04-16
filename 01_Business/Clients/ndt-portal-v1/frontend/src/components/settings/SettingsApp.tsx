import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/adminApi'
import { CheckCircle2, Cloud, Mail, Zap, FlaskConical, Bot, LayoutDashboard, Radio, KeyRound, FolderOpen, ShieldAlert, ListChecks } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import InspectionTypesTab from './InspectionTypesTab'
import DashboardsSettingsTab from './DashboardsSettingsTab'
import RtMachineProfilesTab from './RtMachineProfilesTab'
import ClaudeOAuthTab from './ClaudeOAuthTab'
import SalesforceSettingsTab, { type SalesforceSettings } from './SalesforceSettingsTab'
import EmailSettingsTab, { type EmailSettings } from './EmailSettingsTab'
import N8nSettingsTab, { type N8nSettings } from './N8nSettingsTab'
import LlmSettingsTab from './LlmSettingsTab'
import { FolderReferencesTab } from './FolderReferencesTab'
import ItarKeywordsTab from './ItarKeywordsTab'
import EmailChecksTab from './EmailChecksTab'

// ── Defaults ──────────────────────────────────────────────────────
const SF_DEFAULT: SalesforceSettings = { instanceUrl: '', clientId: '', clientSecret: '', username: '', password: '', webhookSecret: '' }
const EMAIL_DEFAULT: EmailSettings   = {
  provider: '',
  apiKey: '', fromAddress: '', webhookSecret: '', replyToAddress: '',
  imapHost: '', imapPort: '993', imapSecure: true,
  imapUser: '', imapPass: '',
  smtpHost: '', smtpPort: '587', smtpSecure: false,
  smtpUser: '', smtpPass: '',
}
const N8N_DEFAULT: N8nSettings       = { webhookBaseUrl: '/n8n', webhookToken: '', quoteWebhookPath: '/webhook/quote', loginEmail: '', loginPassword: '' }

const LS_KEY = 'ndt_integration_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { salesforce: SalesforceSettings; email: EmailSettings; n8n: N8nSettings }
  } catch { return null }
}

function SavedBadge() {
  return (
    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-4 w-4" /> Saved
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function SettingsApp() {
  const saved = loadSettings()

  const [sf, setSf]       = useState<SalesforceSettings>(saved?.salesforce ?? SF_DEFAULT)
  const [email, setEmail] = useState<EmailSettings>(saved?.email ?? EMAIL_DEFAULT)
  const [n8n, setN8n]     = useState<N8nSettings>(saved?.n8n ?? N8N_DEFAULT)
  const [portalUrl, setPortalUrl] = useState('https://ndt-v1.on-nex.us')
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})

  useEffect(() => {
    adminApi.getPortalConfig()
      .then(data => { if (data?.portalUrl) setPortalUrl(data.portalUrl) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const timers = Object.entries(savedAt).map(([tab]) =>
      setTimeout(() => setSavedAt(prev => { const n = { ...prev }; delete n[tab]; return n }), 3000)
    )
    return () => timers.forEach(clearTimeout)
  }, [savedAt])

  function save(tab: string) {
    const current = loadSettings() ?? { salesforce: SF_DEFAULT, email: EMAIL_DEFAULT, n8n: N8N_DEFAULT }
    localStorage.setItem(LS_KEY, JSON.stringify({ ...current, salesforce: sf, email: email, n8n: n8n }))
    setSavedAt(prev => ({ ...prev, [tab]: Date.now() }))
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Integration Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure external integration credentials. Values are stored locally in your browser.
          Backend activation requires deploying corresponding env vars to the server.
        </p>
      </div>

      <Tabs defaultValue="llm">
        <TabsList className="mb-6">
          <TabsTrigger value="llm" className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> LLM</TabsTrigger>
          <TabsTrigger value="inspection-types" className="flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Inspection Types</TabsTrigger>
          <TabsTrigger value="salesforce" className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> Salesforce</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
          <TabsTrigger value="n8n" className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> n8n</TabsTrigger>
          <TabsTrigger value="dashboards" className="flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" /> Dashboards</TabsTrigger>
          <TabsTrigger value="rt-machines" className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> RT</TabsTrigger>
          <TabsTrigger value="claude-oauth" className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Claude Auth</TabsTrigger>
          <TabsTrigger value="folder-refs" className="flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Folder Refs</TabsTrigger>
          <TabsTrigger value="itar-keywords" className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> ITAR Keywords</TabsTrigger>
          <TabsTrigger value="email-checks" className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Email Checks</TabsTrigger>
        </TabsList>

        <TabsContent value="llm"><LlmSettingsTab /></TabsContent>
        <TabsContent value="inspection-types"><InspectionTypesTab /></TabsContent>
        <TabsContent value="salesforce">
          <SalesforceSettingsTab sf={sf} onChange={setSf} onSave={() => save('salesforce')} savedBadge={savedAt['salesforce'] ? <SavedBadge /> : undefined} />
        </TabsContent>
        <TabsContent value="email">
          <EmailSettingsTab email={email} onChange={setEmail} onSave={() => save('email')} savedBadge={savedAt['email'] ? <SavedBadge /> : undefined} />
        </TabsContent>
        <TabsContent value="n8n">
          <N8nSettingsTab n8n={n8n} onChange={setN8n} onSave={() => save('n8n')} portalUrl={portalUrl} savedBadge={savedAt['n8n'] ? <SavedBadge /> : undefined} />
        </TabsContent>
        <TabsContent value="dashboards"><DashboardsSettingsTab /></TabsContent>
        <TabsContent value="rt-machines"><RtMachineProfilesTab /></TabsContent>
        <TabsContent value="claude-oauth"><ClaudeOAuthTab /></TabsContent>
        <TabsContent value="folder-refs"><FolderReferencesTab /></TabsContent>
        <TabsContent value="itar-keywords"><ItarKeywordsTab /></TabsContent>
        <TabsContent value="email-checks"><EmailChecksTab /></TabsContent>
      </Tabs>
    </div>
  )
}
