"use client"
// apps/web/src/app/(protected)/settings/components/demo-data-card.tsx
// Generate / Delete realistic demo data for testing all modules

import { useState, useEffect } from "react"
import { Sparkles, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"

const DEMO_VISIBLE_KEY = "aios-demo-visible"

type Status = "idle" | "loading" | "success" | "error"

interface SeedResult {
  seeded?: Record<string, number>
  nextcloud?: { uploaded: number; errors: string[] }
  cleared?: { total_rows: number }
  error?: string
}

export function DemoDataCard() {
  const [seedStatus, setSeedStatus] = useState<Status>("idle")
  const [clearStatus, setClearStatus] = useState<Status>("idle")
  const [result, setResult] = useState<SeedResult | null>(null)
  const [demoVisible, setDemoVisible] = useState(true)
  const queryClient = useQueryClient()

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DEMO_VISIBLE_KEY)
    if (stored !== null) {
      setDemoVisible(stored !== "false")
    }
  }, [])

  function toggleDemoVisible() {
    const next = !demoVisible
    setDemoVisible(next)
    localStorage.setItem(DEMO_VISIBLE_KEY, String(next))
  }

  async function handleSeed() {
    setSeedStatus("loading")
    setResult(null)
    try {
      const res = await fetch("/api/bff/demo/seed", { method: "POST" })
      const data: SeedResult = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Seed failed")
      setResult(data)
      setSeedStatus("success")
      // Invalidate all queries so UI refreshes with new data
      queryClient.invalidateQueries()
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Unknown error" })
      setSeedStatus("error")
    }
  }

  async function handleClear() {
    if (!confirm("Delete all demo data? This cannot be undone.")) return
    setClearStatus("loading")
    setResult(null)
    try {
      const res = await fetch("/api/bff/demo/clear", { method: "DELETE" })
      const data: SeedResult = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Clear failed")
      setResult(data)
      setClearStatus("success")
      queryClient.invalidateQueries()
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Unknown error" })
      setClearStatus("error")
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold">Demo Data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Populate the workspace with realistic sample clients, projects, tasks, deals, invoices,
          time entries, and Nextcloud documents for testing and demos.
        </p>
      </div>

      {/* Demo visibility toggle */}
      <div className="flex items-center justify-between rounded-md border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Demo data visible</p>
          <p className="text-xs text-muted-foreground">
            {demoVisible
              ? "Demo data is currently visible across the workspace."
              : "Demo data is hidden — toggle to show."}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={demoVisible}
          onClick={toggleDemoVisible}
          className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${demoVisible ? "bg-primary" : "bg-input"}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0
              transition duration-200
              ${demoVisible ? "translate-x-5" : "translate-x-0"}
            `}
          />
        </button>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleSeed}
          disabled={seedStatus === "loading" || clearStatus === "loading"}
          className="gap-2"
        >
          {seedStatus === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate demo data
        </Button>

        <Button
          variant="outline"
          onClick={handleClear}
          disabled={seedStatus === "loading" || clearStatus === "loading"}
          className="gap-2 text-destructive hover:text-destructive"
        >
          {clearStatus === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete demo data
        </Button>
      </div>

      {/* Result feedback */}
      {result && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            result.error
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400"
          }`}
        >
          {result.error ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{result.error}</span>
            </div>
          ) : result.seeded ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Demo data generated
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                {Object.entries(result.seeded).map(([k, v]) => (
                  <span key={k}>{v} {k.replace(/_/g, " ")}</span>
                ))}
                {result.nextcloud && (
                  <span>{result.nextcloud.uploaded} Nextcloud docs</span>
                )}
              </div>
            </div>
          ) : result.cleared ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Cleared {result.cleared.total_rows} demo records
            </div>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Demo records are tracked separately and can be removed without affecting real data.
        All data is scoped to your workspace tenant.
      </p>
    </div>
  )
}
