"use client"
// apps/web/src/app/(protected)/settings/components/integration-status-panel.tsx
// Auto-refreshing integration health status cards (30s interval)

import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { IntegrationStatus } from "@/types/api"

export function IntegrationStatusPanel() {
  const { data, isLoading } = useQuery<IntegrationStatus[]>({
    queryKey: ["settings", "integrations"],
    queryFn: () =>
      fetch("/api/bff/settings/integrations").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading integrations...</p>
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No integration data available.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Integration Health</h2>
      <div className="flex flex-col gap-3">
        {data.map((integration) => (
          <Card key={integration.service}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {integration.service}
                </CardTitle>
                <Badge
                  variant={integration.status === "healthy" ? "outline" : "destructive"}
                  className={
                    integration.status === "healthy"
                      ? "border-green-500 text-green-600"
                      : undefined
                  }
                >
                  {integration.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Last checked:{" "}
                {new Date(integration.last_checked).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
