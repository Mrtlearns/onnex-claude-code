"use client"
// apps/web/src/app/(protected)/settings/components/plane-integration-form.tsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useSession } from "next-auth/react"

export function PlaneIntegrationForm() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "owner" || (session?.user as any)?.role === "ops_manager"

  const [tokenInput, setTokenInput] = useState("")
  const [slugInput, setSlugInput] = useState("")
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const { data: current } = useQuery<{ plane_api_token: string | null }>({
    queryKey: ["me-integrations"],
    queryFn: () => fetch("/api/bff/me/integrations").then(r => r.json()),
    staleTime: 60_000,
  })

  const { data: workspaceSettings } = useQuery<{ workspace_slug: string | null; base_url: string }>({
    queryKey: ["settings-plane"],
    queryFn: () => fetch("/api/bff/settings/plane").then(r => r.json()),
    staleTime: 60_000,
    enabled: isAdmin,
  })

  const saveMutation = useMutation({
    mutationFn: (token: string) =>
      fetch("/api/bff/me/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plane_api_token: token || null }),
      }).then(r => { if (!r.ok) throw new Error("Save failed"); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me-integrations"] })
      setTokenInput("")
    },
  })

  const saveSlugMutation = useMutation({
    mutationFn: (slug: string) =>
      fetch("/api/bff/settings/plane", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: slug || null }),
      }).then(r => { if (!r.ok) throw new Error("Save failed"); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-plane"] })
      setSlugInput("")
    },
  })

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/bff/plane/projects")
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setTestResult({ ok: false, msg: "Token not configured or invalid — save your PAT below" })
      } else if (res.status === 400) {
        setTestResult({ ok: false, msg: body.error ?? "Plane workspace slug not configured" })
      } else if (!res.ok) {
        setTestResult({ ok: false, msg: body.error ?? `Error ${res.status}` })
      } else {
        setTestResult({ ok: true, msg: `Connected — ${body.length} project(s) found` })
      }
    } catch {
      setTestResult({ ok: false, msg: "Connection failed" })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plane</CardTitle>
        <CardDescription>
          Connect your personal Plane API token to see issues in project views.
          Get your token at{" "}
          <a
            href="https://plane.on-nex.us/profile/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            plane.on-nex.us/profile/ → API Tokens
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="space-y-1.5 border-b pb-4">
            <Label htmlFor="plane-slug" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace Config (Admin)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="plane-slug"
                placeholder={workspaceSettings?.workspace_slug ?? "Workspace slug (e.g. onnex-projects)"}
                value={slugInput}
                onChange={e => setSlugInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => saveSlugMutation.mutate(slugInput)}
                disabled={saveSlugMutation.isPending || !slugInput}
                variant="outline"
              >
                {saveSlugMutation.isPending ? "Saving…" : "Save Slug"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The workspace slug from your Plane URL: plane.on-nex.us/<strong>slug</strong>/
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="plane-token">Personal API Token</Label>
          <div className="flex gap-2">
            <Input
              id="plane-token"
              type="password"
              placeholder={current?.plane_api_token ? "••••••••  (token saved)" : "Paste token here"}
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Testing…" : "Test"}
            </Button>
            <Button
              onClick={() => saveMutation.mutate(tokenInput)}
              disabled={saveMutation.isPending || !tokenInput}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
          {testResult && (
            <p className={`text-xs mt-1 ${testResult.ok ? "text-green-500" : "text-destructive"}`}>
              {testResult.msg}
            </p>
          )}
          {current?.plane_api_token && (
            <p className="text-xs text-muted-foreground">Token is saved. Enter a new value to replace it.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
