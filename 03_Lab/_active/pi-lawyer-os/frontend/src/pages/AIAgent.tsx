import { useState, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Loader2, AlertTriangle, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLlmSettings } from '@/hooks/useLlmSettings';
import { AUTH_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';

type FrameState = 'loading' | 'loaded' | 'error';

const CANVAS_PATH = '/openclaw/';

export default function AIAgent() {
  const [frameState, setFrameState] = useState<FrameState>('loading');
  const [refreshKey, setRefreshKey] = useState(0);
  const [gatewayToken, setGatewayToken] = useState<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { settings: llm } = useLlmSettings();

  // Fetch openclaw gateway token via auth service (requires staff JWT)
  useEffect(() => {
    const staffToken = getToken();
    if (!staffToken) return;
    fetch(`${AUTH_BASE}/openclaw-token`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.token) setGatewayToken(data.token); })
      .catch(() => {});
  }, []);

  const wsUrl = `ws://${window.location.hostname}/openclaw`;
  const openclawUrl = gatewayToken
    ? `${CANVAS_PATH}#gatewayUrl=${encodeURIComponent(wsUrl)}&token=${gatewayToken}`
    : null;
  const openclawDirect = `http://${window.location.hostname}${openclawUrl ?? CANVAS_PATH}`;

  function startTimeout() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setFrameState(prev => (prev === 'loading' ? 'error' : prev));
    }, 20_000);
  }

  function refresh() {
    setFrameState('loading');
    setRefreshKey(k => k + 1);
    startTimeout();
  }

  // Don't start the iframe until we have the token
  if (!openclawUrl) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)] -m-6">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-violet-100 shrink-0">
              <Bot className="w-4 h-4 text-violet-600" />
            </div>
            <span className="text-sm font-semibold text-slate-800">OpenClaw AI Agent Gateway</span>
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">AI Agent</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center bg-slate-50">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      </div>
    );
  }

  function handleLoad() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFrameState('loaded');
  }

  function handleError() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFrameState('error');
  }

  // Start timeout on first render
  if (frameState === 'loading' && refreshKey === 0) {
    startTimeout();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] -m-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-violet-100 shrink-0">
            <Bot className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-800">OpenClaw AI Agent Gateway</span>
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">AI Agent</span>
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{llm.llm_provider}/{llm.llm_model}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {frameState === 'loaded' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Connected
            </span>
          )}
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <a
            href={openclawDirect}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open tab
          </a>
        </div>
      </div>

      {/* Frame area */}
      <div className="relative flex-1 bg-slate-50">
        {frameState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-slate-50">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <p className="text-sm text-slate-500">Connecting to OpenClaw gateway…</p>
          </div>
        )}

        {frameState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-50">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">OpenClaw gateway not responding</p>
              <p className="text-xs text-slate-400">Container may still be starting (allow ~60s on first boot)</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={refresh} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
              <a
                href={openclawDirect}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Try direct link
              </a>
            </div>
          </div>
        )}

        <iframe
          key={refreshKey}
          src={openclawUrl}
          className="w-full h-full border-0"
          title="OpenClaw AI Agent Gateway"
          onLoad={handleLoad}
          onError={handleError}
          allow="*"
        />
      </div>
    </div>
  );
}
