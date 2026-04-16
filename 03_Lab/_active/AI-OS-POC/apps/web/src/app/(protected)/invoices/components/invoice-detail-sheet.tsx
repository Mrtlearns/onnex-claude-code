"use client"
// apps/web/src/app/(protected)/invoices/components/invoice-detail-sheet.tsx
// shadcn Sheet: invoice fields, line items panel, Send + Mark Paid actions

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LineItemsPanel } from "./line-items-panel"
import type { Invoice, InvoiceStatus } from "@/types/api"

interface InvoiceDetailSheetProps {
  invoice: Invoice
  open: boolean
  onClose: () => void
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partial: "Partially Paid",
  void: "Void",
}

export function InvoiceDetailSheet({ invoice, open, onClose }: InvoiceDetailSheetProps) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [showMarkPaid, setShowMarkPaid] = useState(false)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0])

  const isFinanceRole = ["finance", "admin", "super_admin"].includes(
    session?.user?.role ?? ""
  )

  // Send invoice mutation
  const sendMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bff/invoices/${invoice.id}/send`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Send failed")
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      alert("Invoice sent successfully")
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Send failed")
    },
  })

  // Mark paid mutation
  const markPaidMutation = useMutation({
    mutationFn: (paid_at: string) =>
      fetch(`/api/bff/invoices/${invoice.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", paid_at }),
      }).then((r) => {
        if (!r.ok) throw new Error("Update failed")
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      setShowMarkPaid(false)
      onClose()
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : "Update failed")
    },
  })

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Invoice
              <Badge variant="secondary">{STATUS_LABELS[invoice.status]}</Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Invoice fields */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Invoice ID</p>
                <p className="font-mono text-xs">{invoice.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <p>{STATUS_LABELS[invoice.status]}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Due Date</p>
                <p>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tax</p>
                <p>{invoice.tax_pct}%</p>
              </div>
              {invoice.sent_at && (
                <div>
                  <p className="text-muted-foreground text-xs">Sent At</p>
                  <p>{new Date(invoice.sent_at).toLocaleString()}</p>
                </div>
              )}
              {invoice.paid_at && (
                <div>
                  <p className="text-muted-foreground text-xs">Paid At</p>
                  <p>{new Date(invoice.paid_at).toLocaleString()}</p>
                </div>
              )}
              {invoice.notes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="text-sm">{invoice.notes}</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {isFinanceRole && (
              <div className="flex gap-2 flex-wrap">
                {(invoice.status === "draft" || invoice.status === "sent") && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending ? "Sending..." : "Send Invoice"}
                  </Button>
                )}
                {(invoice.status === "sent" || invoice.status === "partial") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMarkPaid(true)}
                  >
                    Mark as Paid
                  </Button>
                )}
              </div>
            )}

            <Separator />

            {/* Line items */}
            <LineItemsPanel invoiceId={invoice.id} isFinanceRole={isFinanceRole} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mark Paid dialog */}
      <Dialog open={showMarkPaid} onOpenChange={setShowMarkPaid}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="paid-date" className="text-sm">Payment Date</Label>
              <Input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowMarkPaid(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => markPaidMutation.mutate(paidDate)}
                disabled={markPaidMutation.isPending || !paidDate}
              >
                {markPaidMutation.isPending ? "Saving..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
