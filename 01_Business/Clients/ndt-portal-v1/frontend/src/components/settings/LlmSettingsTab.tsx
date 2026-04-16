import { useCallback, useEffect, useState } from 'react'
import { settingsApi } from '@/lib/settingsApi'
import { Save, Bot, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface ProviderConfig {
  name: string
  label: string
  defaultModel: string
  model: string
  apiKey: string
  hasKey: boolean
}

interface ProvidersState {
  providers: ProviderConfig[]
  defaultProvider: string
}

const PROVIDER_META: Record<string, { color: string; short: string }> = {
  openrouter: { color: 'text-orange-600',  short: 'OR' },
  anthropic:  { color: 'text-amber-600',   short: 'AN' },
  openai:     { color: 'text-green-600',   short: 'OA' },
  gemini:     { color: 'text-blue-600',    short: 'GM' },
}

function SavedBadge() {
  return (
    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
      <Save className="h-4 w-4" /> Saved
    </span>
  )
}

export default function LlmSettingsTab() {
  const [providers, setProviders]               = useState<ProviderConfig[]>([])
  const [defaultProvider, setDefaultProvider]   = useState('openrouter')
  const [providerKeys, setProviderKeys]         = useState<Record<string, string>>({})
  const [providerModels, setProviderModels]     = useState<Record<string, string>>({})
  const [testResults, setTestResults]           = useState<Record<string, { ok: boolean; message: string }>>({})
  const [testingProvider, setTestingProvider]   = useState<string | null>(null)
  const [savingProvider, setSavingProvider]     = useState<string | null>(null)
  const [llmLoading, setLlmLoading]             = useState(false)
  const [chatProvider, setChatProvider]   = useState('')
  const [chatModel, setChatModel]         = useState('')
  const [chatSaving, setChatSaving]       = useState(false)
  const [chatSaved, setChatSaved]         = useState(false)

  const loadProviders = useCallback(async () => {
    setLlmLoading(true)
    try {
      const data: ProvidersState = await settingsApi.getProviders()
      setProviders(data.providers)
      setDefaultProvider(data.defaultProvider)
      const models: Record<string, string> = {}
      for (const p of data.providers) models[p.name] = p.model
      setProviderModels(models)
      const cd = await settingsApi.getChat()
      if (cd.chatProvider) setChatProvider(cd.chatProvider)
      if (cd.chatModel)    setChatModel(cd.chatModel)
    } finally { setLlmLoading(false) }
  }, [])

  useEffect(() => { loadProviders() }, [loadProviders])

  async function saveProvider(name: string, isDefault: boolean) {
    setSavingProvider(name)
    try {
      const apiKey = providerKeys[name] ?? ''
      const model  = providerModels[name] ?? ''
      await settingsApi.saveProvider(name, { ...(apiKey ? { apiKey } : {}), ...(model ? { model } : {}), ...(isDefault ? { setDefault: true } : {}) })
      if (isDefault) setDefaultProvider(name)
      setProviderKeys(prev => ({ ...prev, [name]: '' }))
      await loadProviders()
    } finally { setSavingProvider(null) }
  }

  async function testProvider(name: string) {
    setTestingProvider(name)
    setTestResults(prev => ({ ...prev, [name]: { ok: false, message: 'Testing…' } }))
    try {
      const data = await settingsApi.testProvider(name, { apiKey: providerKeys[name] || undefined })
      setTestResults(prev => ({ ...prev, [name]: { ok: data.ok, message: data.ok ? `${data.message} (${data.latencyMs}ms)` : data.error } }))
    } finally { setTestingProvider(null) }
  }

  async function saveChatSettings() {
    if (!chatProvider) return
    setChatSaving(true)
    try {
      await settingsApi.saveChat({ chatProvider, chatModel })
      setChatSaved(true)
      setTimeout(() => setChatSaved(false), 3000)
    } finally { setChatSaving(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-500" /> LLM Providers
        </CardTitle>
        <CardDescription className="mt-1">
          Configure API keys and default models for each provider. Set the default provider
          used by the pipeline when a step has no override.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {llmLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Default Provider selector */}
            <div className="flex items-center gap-3 pb-2">
              <Label className="text-sm whitespace-nowrap">Default Provider</Label>
              <Select value={defaultProvider} onValueChange={name => saveProvider(name, true)}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => <SelectItem key={p.name} value={p.name}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Used when a pipeline step has no provider override</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(p => {
                const meta       = PROVIDER_META[p.name] ?? { color: 'text-gray-600', short: p.name.slice(0, 2).toUpperCase() }
                const isDefault  = p.name === defaultProvider
                const testResult = testResults[p.name]
                return (
                  <div key={p.name} className={`rounded-lg border bg-card p-4 space-y-3 ${isDefault ? 'border-primary/50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm font-mono ${meta.color}`}>{meta.short}</span>
                        <span className="font-medium text-sm">{p.label}</span>
                        {isDefault && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">DEFAULT</span>}
                      </div>
                      {p.hasKey && <span className="text-[10px] text-green-600 font-medium">KEY SET</span>}
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">API Key</Label>
                        <Input
                          type="password" placeholder={p.hasKey ? '••••••••' : 'Paste API key…'}
                          value={providerKeys[p.name] ?? ''}
                          onChange={e => setProviderKeys(prev => ({ ...prev, [p.name]: e.target.value }))}
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Default Model</Label>
                        <Input
                          placeholder={p.defaultModel}
                          value={providerModels[p.name] ?? p.model}
                          onChange={e => setProviderModels(prev => ({ ...prev, [p.name]: e.target.value }))}
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                    </div>
                    {testResult && (
                      <p className={`text-xs ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResult.ok ? '✓' : '✗'} {testResult.message}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => testProvider(p.name)} disabled={testingProvider === p.name}>
                        {testingProvider === p.name ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Test
                      </Button>
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => saveProvider(p.name, false)} disabled={savingProvider === p.name}>
                        {savingProvider === p.name ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}Save
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chat AI Settings */}
            {providers.some(p => p.hasKey) && (
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Chat AI Settings</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Provider and model used specifically by the Analytics AI Chat assistant.</p>
                  </div>
                  {chatSaved && <SavedBadge />}
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Chat Provider</Label>
                    <Select value={chatProvider} onValueChange={v => { setChatProvider(v); const prov = providers.find(p => p.name === v); if (prov && !chatModel) setChatModel(prov.model || prov.defaultModel) }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select provider…" /></SelectTrigger>
                      <SelectContent>
                        {providers.filter(p => p.hasKey).map(p => {
                          const meta = PROVIDER_META[p.name] ?? { color: 'text-gray-600', short: p.name.slice(0,2).toUpperCase() }
                          return (
                            <SelectItem key={p.name} value={p.name}>
                              <span className={`font-mono font-bold text-xs mr-1.5 ${meta.color}`}>{meta.short}</span>{p.label}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chat Model</Label>
                    <Input
                      placeholder={providers.find(p => p.name === chatProvider)?.defaultModel ?? 'e.g. claude-haiku-4-5-20251001'}
                      value={chatModel}
                      onChange={e => setChatModel(e.target.value)}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button size="sm" className="h-7 text-xs" onClick={saveChatSettings} disabled={chatSaving || !chatProvider}>
                    {chatSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}Save Chat Settings
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
