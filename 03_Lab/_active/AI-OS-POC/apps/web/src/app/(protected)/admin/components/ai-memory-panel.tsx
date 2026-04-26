"use client"
// apps/web/src/app/(protected)/admin/components/ai-memory-panel.tsx
// AI Memory management: stats display + Clear Memory with confirmation dialog

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { AiMemoryStats } from "@/types/api"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function AiMemoryPanel() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery<AiMemoryStats>({
    queryKey: ["ai", "memory-stats"],
    queryFn: () =>
      fetch("/api/bff/ai/memory").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch AI memory stats")
        return r.json()
      }),
    staleTime: 30_000,
  })

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bff/ai/memory", { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed to clear AI memory")
      }
      return res.json() as Promise<{ deleted: number }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai", "memory-stats"] })
      toast.success(`AI memory cleared (${data.deleted} entries deleted)`)
      setConfirmOpen(false)
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to clear AI memory")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Memory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          {isLoading ? (
            <>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
            </>
          ) : stats ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 pb-1">Conversational Memory</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Memory Entries</span>
                <span className="font-medium">{stats.entry_count.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vector Storage</span>
                <span className="font-medium">{formatBytes(stats.vector_storage_bytes)}</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 pt-3 pb-1">RAG Knowledge Base (Nextcloud)</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Document Chunks</span>
                <span className="font-medium">{(stats.rag_chunk_count ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vector Storage</span>
                <span className="font-medium">{formatBytes(stats.rag_storage_bytes ?? 0)}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Unable to load memory stats.</p>
          )}
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isLoading || !stats}>
              Clear Memory
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Clear AI Memory?</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                This will delete all{" "}
                <strong>{stats?.entry_count.toLocaleString() ?? "0"}</strong> memory entries.
                This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={clearMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
              >
                {clearMutation.isPending ? "Clearing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
