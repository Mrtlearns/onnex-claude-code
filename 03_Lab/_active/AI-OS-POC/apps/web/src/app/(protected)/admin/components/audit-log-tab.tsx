"use client"
// apps/web/src/app/(protected)/admin/components/audit-log-tab.tsx
// Read-only expandable audit log table — NO delete/edit actions

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditLogEntry } from "@/types/api"

export function AuditLogTab() {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const { data: entries = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["audit-log"],
    queryFn: () => fetch("/api/bff/admin/audit-log").then((r) => r.json()),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="py-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No audit log entries found
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <>
              <TableRow
                key={entry.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() =>
                  setExpandedRowId((prev) => (prev === entry.id ? null : entry.id))
                }
              >
                <TableCell>{entry.actor_name}</TableCell>
                <TableCell className="font-mono text-sm">{entry.action}</TableCell>
                <TableCell>
                  {entry.target_label ?? entry.target_id ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(entry.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
              {expandedRowId === entry.id && (
                <TableRow key={`${entry.id}-expanded`}>
                  <TableCell colSpan={4} className="p-0">
                    <pre className="text-xs bg-muted p-2 rounded m-2 overflow-auto max-h-48">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
