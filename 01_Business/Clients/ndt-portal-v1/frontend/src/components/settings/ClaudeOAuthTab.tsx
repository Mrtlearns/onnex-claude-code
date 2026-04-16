import { useState, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/api'
import { KeyRound, CheckCircle2, XCircle, Loader2, Trash2, TestTube, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Button } from '../ui/button'

const API_BASE      = '/api/ut/settings/claude-oauth'
const AUTH_METHOD_BASE = '/api/ut/settings/llm-auth-method'

interface OAuthStatus {
  stored:         boolean
  preview:        string
  savedAt:        string
  verifiedAt:     string
  verifiedStatus: 'ok' | 'error' | 'pending' | 'unknown'
  expiresApprox:  string
  notes:          string
}

function StatusBadge({ status }: { status: OAuthStatus['verifiedStatus'] }) {
  const map = {
    ok:      { cls: 'text-green-600 dark:text-green-400',  icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Verified' },
    error:   { cls: 'text-red-500',                        icon: <XCircle className="h-3.5 w-3.5" />,      label: 'Error'    },
    pending: { cls: 'text-yellow-500',                     icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Pending' },
    unknown: { cls: 'text-muted-foreground',               icon: null,                                      label: 'Not tested' },
  } as const
  const s = map[status] ?? map.unknown
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  )
}

export default function ClaudeOAuthTab() {
  const [status, setStatus]         = useState<OAuthStatus | null>(null)
  const [token, setToken]           = useState('')
  const [notes, setNotes]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [testing, setTesting]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [feedback, setFeedback]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [authMethod, setAuthMethod] = useState<'oauth_cli' | 'api_key'>('oauth_cli')
  const [togglingAuth, setTogglingAuth] = useState(false)

  function showFeedback(msg: string, ok: boolean) {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function loadStatus() {
    setLoading(true)
    try {
      const [oauthRes, methodRes] = await Promise.all([
        fetch(API_BASE, { headers: getAuthHeaders() }),
        fetch(AUTH_METHOD_BASE, { headers: getAuthHeaders() }),
      ])
      if (oauthRes.ok)  setStatus(await oauthRes.json())
      if (methodRes.ok) {
        const d = await methodRes.json()
        setAuthMethod(d.method ?? 'oauth_cli')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  async function handleToggleAuthMethod() {
    const next = authMethod === 'oauth_cli' ? 'api_key' : 'oauth_cli'
    setTogglingAuth(true)
    try {
      const r = await fetch(AUTH_METHOD_BASE, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ method: next }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) return showFeedback(d.error ?? 'Toggle failed', false)
      setAuthMethod(next)
      showFeedback(
        next === 'oauth_cli'
          ? 'Switched to OAuth CLI — LLM calls use Claude CLI'
          : 'Switched to API Key — LLM calls use provider API key',
        true,
      )
    } finally {
      setTogglingAuth(false)
    }
  }

  async function handleSave() {
    if (!token) return showFeedback('Paste a token first.', false)
    setSaving(true)
    try {
      const r = await fetch(API_BASE, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token, notes }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok) return showFeedback(data.error ?? 'Save failed', false)
      showFeedback(`Saved — ${data.preview}`, true)
      setToken('')
      await loadStatus()
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const r = await fetch(`${API_BASE}/test`, { method: 'POST', headers: getAuthHeaders() })
      const data = await r.json()
      if (data.ok) showFeedback(`${data.message} (${data.latencyMs}ms)`, true)
      else showFeedback(`Test failed: ${data.error}`, false)
      await loadStatus()
    } finally {
      setTesting(false)
    }
  }

  async function handleClear() {
    if (!confirm('Clear stored token?')) return
    await fetch(API_BASE, { method: 'DELETE', headers: getAuthHeaders() })
    showFeedback('Token cleared.', true)
    await loadStatus()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-500" /> Claude OAuth Token
        </CardTitle>
        <CardDescription className="mt-1">
          Long-lived OAuth token for Claude Code CLI ({' '}
          <code className="text-xs">CLAUDE_CODE_OAUTH_TOKEN</code>). Generate one with{' '}
          <code className="text-xs">claude setup-token</code> on your Windows machine, then paste it here.
          Token is validated every 12 hours automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* LLM auth method toggle */}
        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">LLM Auth Method</p>
            <p className="text-xs text-muted-foreground">
              {authMethod === 'oauth_cli'
                ? 'OAuth CLI — routes all CLOUD_OK LLM calls through claude CLI using the token below'
                : 'API Key — routes LLM calls directly to the provider using an API key'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAuthMethod}
            disabled={togglingAuth || loading}
            className="ml-4 flex items-center gap-2 min-w-[120px]"
          >
            {togglingAuth ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : authMethod === 'oauth_cli' ? (
              <ToggleRight className="h-4 w-4 text-green-500" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
            {authMethod === 'oauth_cli' ? 'OAuth CLI' : 'API Key'}
          </Button>
        </div>

        {/* Current status */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : status ? (
          <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{status.stored ? status.preview : 'No token stored'}</span>
              <StatusBadge status={status.verifiedStatus} />
            </div>
            {status.stored && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground font-mono">
                {status.savedAt     && <span>Saved: {status.savedAt.slice(0, 10)}</span>}
                {status.expiresApprox && <span>Expires ≈ {status.expiresApprox}</span>}
                {status.verifiedAt  && <span>Last checked: {status.verifiedAt.slice(0, 10)}</span>}
                {status.notes       && <span>Note: {status.notes}</span>}
              </div>
            )}
          </div>
        ) : null}

        {/* Token input */}
        <div className="space-y-1.5">
          <Label htmlFor="oauth-token">New token</Label>
          <Input
            id="oauth-token"
            type="password"
            value={token}
            placeholder="sk-ant-oat01-..."
            onChange={e => setToken(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oauth-notes">Notes (optional)</Label>
          <Input
            id="oauth-notes"
            value={notes}
            placeholder="e.g. generated 2026-04-01, expires 2027-04-01"
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          <Button onClick={handleSave} disabled={saving || !token} className="flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Save token
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !status?.stored} className="flex items-center gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            Test
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={!status?.stored} className="flex items-center gap-2 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>

          {feedback && (
            <span className={`flex items-center gap-1.5 text-sm ${feedback.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {feedback.ok
                ? <CheckCircle2 className="h-4 w-4" />
                : <XCircle className="h-4 w-4" />}
              {feedback.msg}
            </span>
          )}
        </div>

        {/* Host apply instructions */}
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Apply to WSL shell environment:</p>
          <p>After saving, run once in WSL to export the token for <code>claude</code> CLI sessions:</p>
          <code className="block mt-1 text-xs">bash scripts/apply-claude-token.sh</code>
        </div>
      </CardContent>
    </Card>
  )
}
