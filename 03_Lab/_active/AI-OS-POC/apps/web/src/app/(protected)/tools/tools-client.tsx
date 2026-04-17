"use client"

import { useState, useEffect, useRef } from "react"
import { ExternalLink, RefreshCw, Loader2, AlertTriangle, Workflow, Timer, Bot, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const TOOLS = [
  {
    id: "n8n",
    label: "n8n",
    description: "Workflow automation — build and monitor AI pipelines",
    directUrl: "http://10.10.110.31:5678",
    proxyUrl: "/n8n/",
    icon: Workflow,
    color: "text-orange-500",
    badge: "Automation",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  {
    id: "temporal",
    label: "Temporal",
    description: "Durable workflow orchestration — task queues and execution history",
    directUrl: "http://10.10.110.31:8080",
    proxyUrl: "/temporal/",
    icon: Timer,
    color: "text-blue-500",
    badge: "Orchestration",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    description: "AI agent runtime — autonomous task execution gateway",
    directUrl: "http://10.10.110.31:47823",
    proxyUrl: "/openclaw/",
    icon: Bot,
    color: "text-violet-500",
    badge: "AI Agent",
    badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
] as const

type ToolId = (typeof TOOLS)[number]["id"]

type FrameState = "loading" | "loaded" | "error"

export function ToolsClient() {
  const [activeTool, setActiveTool] = useState<ToolId>("n8n")
  const [frameState, setFrameState] = useState<Record<string, FrameState>>({
    n8n: "loading", temporal: "loading", openclaw: "loading",
  })
  const [refreshKey, setRefreshKey] = useState<Record<string, number>>({ n8n: 0, temporal: 0, openclaw: 0 })
  const timeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const tool = TOOLS.find(t => t.id === activeTool)!

  // Reset frame state when refreshed
  function refresh(id: string) {
    clearTimeout(timeouts.current[id])
    setFrameState(prev => ({ ...prev, [id]: "loading" }))
    setRefreshKey(prev => ({ ...prev, [id]: prev[id] + 1 }))
  }

  // Set per-frame load timeout — if onLoad doesn't fire in 15s, assume blocked
  useEffect(() => {
    const id = activeTool
    if (frameState[id] !== "loading") return
    clearTimeout(timeouts.current[id])
    timeouts.current[id] = setTimeout(() => {
      setFrameState(prev => prev[id] === "loading" ? { ...prev, [id]: "error" } : prev)
    }, 15_000)
    return () => clearTimeout(timeouts.current[id])
  }, [activeTool, refreshKey[activeTool]])

  function handleLoad(id: string) {
    clearTimeout(timeouts.current[id])
    setFrameState(prev => ({ ...prev, [id]: "loaded" }))
  }

  function handleError(id: string) {
    clearTimeout(timeouts.current[id])
    setFrameState(prev => ({ ...prev, [id]: "error" }))
  }

  const state = frameState[activeTool]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Tool selector strip */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Tools</span>
        {TOOLS.map(t => {
          const Icon = t.icon
          const isActive = activeTool === t.id
          const tState = frameState[t.id]
          return (
            <div key={t.id} className="flex items-center">
              <button
                onClick={() => setActiveTool(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-background shadow-sm border text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? t.color : ""}`} />
                {t.label}
                {tState === "loaded" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-0.5" />
                )}
                {tState === "error" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ml-0.5" />
                )}
                {tState === "loading" && isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5" />
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); refresh(t.id) }}
                title={`Refresh ${t.label}`}
                className="ml-0.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${tState === "loading" ? "animate-spin" : ""}`} />
              </button>
            </div>
          )
        })}

        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tool.badgeClass}`}>
            {tool.badge}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(tool.directUrl, "_blank")} title="Open in new tab">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Iframe area */}
      <div className="flex-1 relative overflow-hidden">
        {TOOLS.map(t => (
          <div key={t.id} className={`absolute inset-0 ${activeTool === t.id ? "flex flex-col" : "hidden"}`}>

            {/* Loading */}
            {frameState[t.id] === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10 gap-3">
                <Loader2 className={`h-8 w-8 animate-spin ${t.color}`} />
                <p className="text-sm text-muted-foreground">Connecting to {t.label}...</p>
                <p className="text-xs text-muted-foreground font-mono opacity-60">{t.directUrl}</p>
              </div>
            )}

            {/* Blocked / error */}
            {frameState[t.id] === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10 gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-muted`}>
                  <t.icon className={`h-8 w-8 ${t.color}`} />
                </div>
                <div className="text-center space-y-1 max-w-sm">
                  <p className="font-semibold text-lg">{t.label}</p>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <p className="text-xs text-amber-500 mt-2">
                    Embedded view blocked — open in a dedicated tab for full functionality
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => refresh(t.id)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Embed
                  </Button>
                  <Button size="sm" onClick={() => window.open(t.directUrl, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open {t.label}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{t.directUrl}</p>
              </div>
            )}

            <iframe
              key={refreshKey[t.id]}
              src={t.proxyUrl}
              className="w-full flex-1 border-0"
              style={{ display: frameState[t.id] === "loaded" ? "block" : "none" }}
              onLoad={() => handleLoad(t.id)}
              onError={() => handleError(t.id)}
              title={t.label}
              allow="*"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-top-navigation-by-user-activation"
            />
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-t bg-muted/20 text-xs text-muted-foreground shrink-0">
        <span className={tool.color + " font-medium"}>{tool.label}</span>
        {state === "loaded" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {state === "error" && <AlertTriangle className="h-3 w-3 text-amber-500" />}
        {state === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
        <span className="font-mono">{tool.directUrl}</span>
        <span className="ml-auto">{tool.description}</span>
      </div>
    </div>
  )
}
