"use client"
// apps/web/src/app/(protected)/settings/components/dev-tool-integrations-card.tsx
// Shows GitHub + GitLab webhook URLs (read-only) with copy buttons.

import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Clipboard, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface IntegrationConfig {
  github_webhook_url: string
  github_webhook_secret_env: string
  gitlab_webhook_url: string
  gitlab_webhook_secret_env: string
  tenant_id_header: string
}

function copyToClipboard(value: string, label: string) {
  navigator.clipboard.writeText(value).then(() => {
    toast.success(`${label} copied to clipboard`)
  }).catch(() => {
    toast.error("Failed to copy to clipboard")
  })
}

export function DevToolIntegrationsCard() {
  const { data, isLoading, isError } = useQuery<IntegrationConfig>({
    queryKey: ["integrations", "config"],
    queryFn: () => fetch("/api/bff/integrations/config").then(r => r.json()),
    staleTime: 5 * 60_000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dev Tool Integrations</CardTitle>
        <CardDescription>
          Configure GitHub and GitLab to send webhook events to your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* GitHub */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">GitHub</h3>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Webhook URL</label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : isError || !data ? (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4" />
                Could not load webhook URL
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={data.github_webhook_url}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(data.github_webhook_url, "GitHub webhook URL")}
                  title="Copy URL"
                >
                  <Clipboard className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Webhook Secret</label>
            <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1.5">
              {isLoading ? (
                <Skeleton className="h-4 w-40 inline-block" />
              ) : (
                data?.github_webhook_secret_env ?? "GITHUB_WEBHOOK_SECRET"
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Set this env var on your API server to the secret you configure in GitHub.
            </p>
          </div>
        </div>

        <Separator />

        {/* GitLab */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">GitLab</h3>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Webhook URL</label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : isError || !data ? (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4" />
                Could not load webhook URL
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={data.gitlab_webhook_url}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(data.gitlab_webhook_url, "GitLab webhook URL")}
                  title="Copy URL"
                >
                  <Clipboard className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Webhook Secret</label>
            <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1.5">
              {isLoading ? (
                <Skeleton className="h-4 w-40 inline-block" />
              ) : (
                data?.gitlab_webhook_secret_env ?? "GITLAB_WEBHOOK_SECRET"
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Set this env var on your API server to the secret you configure in GitLab.
            </p>
          </div>
        </div>

        <Separator />

        {/* Instructions */}
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium">Setup Instructions</p>
          <ol className="text-[11px] text-muted-foreground list-decimal ml-4 space-y-1">
            <li>Copy the webhook URL for your platform above.</li>
            <li>In GitHub / GitLab, add a new webhook pointing to that URL.</li>
            <li>Generate a secret token and set it as the corresponding env var on your API server.</li>
            <li>
              <span>Set the </span>
              <code className="font-mono bg-muted rounded px-1">
                {data?.tenant_id_header ?? "x-tenant-id"}
              </code>
              <span> header in your webhook to route events to your workspace.</span>
            </li>
            <li>Select the events you want to receive (push, pull request, issues, etc.).</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
