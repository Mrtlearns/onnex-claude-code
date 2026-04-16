"use client"
// apps/web/src/app/(protected)/invoices/components/invoice-list.tsx
// Invoice list with overdue highlight (computed from due_date vs today, no DB flag)

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceForm } from "./invoice-form"
import { InvoiceDetailSheet } from "./invoice-detail-sheet"
import type { Invoice, InvoiceStatus } from "@/types/api"

// ─── isOverdue helper — exported for unit testing ─────────────────────────────
// Computed from due_date vs today — NO DB flag. Pure function.
export function isOverdue(invoice: Invoice): boolean {
  if (!invoice.due_date) return false
  if ((["paid", "void"] as InvoiceStatus[]).includes(invoice.status)) return false
  return new Date(invoice.due_date) < new Date()
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_VARIANTS: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
  partial: "secondary",
  void: "outline",
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={status === "void" ? "line-through opacity-60" : ""}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

// ─── InvoiceList ──────────────────────────────────────────────────────────────
export function InvoiceList() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () =>
      fetch("/api/bff/invoices").then((r) => {
        if (!r.ok) throw new Error("Failed to load invoices")
        return r.json()
      }),
    staleTime: 60_000,
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bff/invoices/${id}/send`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Send failed")
        return r.json()
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button onClick={() => setShowCreate(true)}>New Invoice</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No invoices found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className={
                  isOverdue(invoice)
                    ? "border-l-4 border-red-500 bg-red-50 cursor-pointer"
                    : "cursor-pointer"
                }
                onClick={() => setSelectedInvoice(invoice)}
                data-overdue={isOverdue(invoice) ? "true" : undefined}
              >
                <TableCell className="font-mono text-xs">
                  {invoice.id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} />
                  {isOverdue(invoice) && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Overdue
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {invoice.due_date
                    ? new Date(invoice.due_date).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>{invoice.tax_pct}%</TableCell>
                <TableCell>
                  {new Date(invoice.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  {(invoice.status === "draft" || invoice.status === "sent") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendMutation.mutate(invoice.id)}
                      disabled={sendMutation.isPending}
                    >
                      Send
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedInvoice(invoice)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <InvoiceForm
            onSuccess={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      {selectedInvoice && (
        <InvoiceDetailSheet
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}
