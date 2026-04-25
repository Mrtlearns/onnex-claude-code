"use client"
// apps/web/src/app/(protected)/settings/components/plane-integration-form.tsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function PlaneIntegrationForm() {
  const queryClient = useQueryClient()
  const [tokenInput, setTokenInput] = useState("")
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const { data: current } = useQuery<{ plane_api_token: string | null }>({
    queryKey: ["me-integrations"],
    queryFn: () => fetch("/api/bff/me/integrations").then(r => r.json()),
    staleTime: 60_000,
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

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/bff/plane/projects")
      if (res.status === 401) {
        setTestResult({ ok: false, msg: "Token not configured or invalid" })
      } else if (!res.ok) {
        setTestResult({ ok: false, msg: `Error ${res.status}` })
      } else {
        const projects = await res.json()
        setTestResult({ ok: true, msg: `Connected — ${projects.length} project(s) found` })
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
