import { useState, useRef } from 'react'
import { ExternalLink, RefreshCw, Workflow, AlertCircle, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tool registry ───────────────────────────────────────────────
const TOOLS = [
  {
    id: 'n8n',
    label: 'n8n Workflows',
    icon: Workflow,
    src: '/n8n/',
    description: 'Build and manage automation workflows',
  },
] as const

type ToolId = (typeof TOOLS)[number]['id']

// ── Load saved n8n login credentials from localStorage ──────────
function loadN8nCreds(): { loginEmail: string; loginPassword: string } | null {
  try {
    const raw = localStorage.getItem('ndt_integration_settings')
    if (!raw) return null
    const settings = JSON.parse(raw)
    const { loginEmail, loginPassword } = settings?.n8n ?? {}
    if (loginEmail && loginPassword) return { loginEmail, loginPassword }
    return null
  } catch {
    return null
  }
}

// ── Auto-fill n8n login form inside the iframe ──────────────────
// n8n uses React internally, so we must use the native input setter
// to trigger React's onChange handler, otherwise the submit is ignored.
function tryAutoLogin(iframe: HTMLIFrameElement, creds: { loginEmail: string; loginPassword: string }): boolean {
  try {
    const doc = iframe.contentDocument
    if (!doc) return false

    const emailInput = doc.querySelector<HTMLInputElement>('input[type="email"], input[name="email"]')
    const passInput  = doc.querySelector<HTMLInputElement>('input[type="password"]')
    if (!emailInput || !passInput) return false

    // Use React's native input value setter to trigger synthetic onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(
      (iframe.contentWindow as Window & typeof globalThis).HTMLInputElement.prototype,
      'value',
    )?.set

    if (!nativeSetter) return false

    nativeSetter.call(emailInput, creds.loginEmail)
    emailInput.dispatchEvent(new Event('input', { bubbles: true }))

    nativeSetter.call(passInput, creds.loginPassword)
    passInput.dispatchEvent(new Event('input', { bubbles: true }))

    // Small delay to let React re-render, then click submit
    setTimeout(() => {
      const submitBtn = doc.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?? doc.querySelector<HTMLButtonElement>('form button')
      submitBtn?.click()
    }, 80)

    return true
  } catch {
    // Cross-origin guard (shouldn't happen since n8n is same-origin, but be safe)
    return false
  }
}

// ── Component ───────────────────────────────────────────────────
export default function ToolsApp() {
  const [activeTool, setActiveTool]   = useState<ToolId>('n8n')
  const [iframeState, setIframeState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [frameKey, setFrameKey]       = useState(0)
  const [autoLogged, setAutoLogged]   = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const tool = TOOLS.find(t => t.id === activeTool) ?? TOOLS[0]

  function selectTool(id: ToolId) {
    setActiveTool(id)
    setIframeState('loading')
    setAutoLogged(false)
    setFrameKey(k => k + 1)
  }

  function refresh() {
    setIframeState('loading')
    setAutoLogged(false)
    setFrameKey(k => k + 1)
  }

  function openFullScreen() {
    window.open(tool.src, '_blank', 'noopener,noreferrer')
  }

  function handleLoad() {
    setIframeState('ready')

    if (activeTool !== 'n8n') return

    const creds = loadN8nCreds()
    if (!creds || !iframeRef.current) return

    const didFill = tryAutoLogin(iframeRef.current, creds)
    if (didFill) setAutoLogged(true)
  }

  const hasCreds = Boolean(loadN8nCreds())

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border bg-card shrink-0">

        {/* Tool tabs */}
        <div className="flex items-center gap-1">
          {TOOLS.map(t => {
            const Icon = t.icon
            const active = t.id === activeTool
            return (
              <button
                key={t.id}
                onClick={() => selectTool(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Status indicators */}
        {iframeState === 'loading' && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading…
          </span>
        )}
        {iframeState === 'error' && (
          <span className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed to load — n8n may still be starting up
          </span>
        )}
        {iframeState === 'ready' && activeTool === 'n8n' && autoLogged && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <KeyRound className="h-3 w-3" />
            Auto-logged in
          </span>
        )}
        {iframeState === 'ready' && activeTool === 'n8n' && !autoLogged && !hasCreds && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3 w-3" />
            <a href="/settings" className="underline underline-offset-2 hover:no-underline">
              Save n8n credentials
            </a>
            {' '}to enable auto-login
          </span>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={refresh}
          title="Reload"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={openFullScreen}
          title="Open in new tab"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── iframe ── */}
      <div className="relative flex-1 min-h-0 bg-background">

        {/* Loading overlay */}
        {iframeState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground z-10 bg-background">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading {tool.label}…</p>
            <p className="text-xs">
              First launch may take 15–30 seconds while n8n initializes.
            </p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={frameKey}
          src={tool.src}
          title={tool.label}
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
          onLoad={handleLoad}
          onError={() => setIframeState('error')}
        />
      </div>
    </div>
  )
}
