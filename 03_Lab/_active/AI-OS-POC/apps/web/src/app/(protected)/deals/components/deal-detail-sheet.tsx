"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { Deal, DealStatus } from "@/types/api"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const STATUS_OPTIONS: DealStatus[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"]
const STATUS_LABELS: Record<DealStatus, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
}
const STATUS_BADGE_VARIANTS: Record<DealStatus, "default" | "secondary" | "destructive" | "outline"> = {
  lead: "secondary",
  qualified: "secondary",
  proposal: "outline",
  negotiation: "outline",
  won: "default",
  lost: "destructive",
}

interface DealDetailSheetProps {
  deal: Deal
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DealDetailSheet({ deal, open, onOpenChange }: DealDetailSheetProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [notes, setNotes] = useState("")

  const { mutate: patchDeal } = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      fetch(`/api/bff/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  })

  const { mutate: convertToInvoice, isPending: isConverting } = useMutation({
    mutationFn: async () =>
      fetch(`/api/bff/deals/${deal.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] })
      router.push("/invoices")
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <SheetTitle className="flex-1 text-lg leading-tight">{deal.title}</SheetTitle>
            <Badge variant={STATUS_BADGE_VARIANTS[deal.status]} className="shrink-0 capitalize">
              {STATUS_LABELS[deal.status]}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Stage select */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Stage</Label>
            <Select
              value={deal.status}
              onValueChange={val => patchDeal({ status: val as DealStatus, stage: val })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s} className="text-sm capitalize">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input
                value={`$${deal.value.toLocaleString()}`}
                readOnly
                className="h-8 text-sm text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Probability</Label>
              <Input
                value={`${deal.probability}%`}
                readOnly
                className="h-8 text-sm text-muted-foreground"
              />
            </div>
          </div>

          {/* Weighted value */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Weighted Value</Label>
            <p className="text-sm font-medium text-foreground">
              ${((deal.value * deal.probability) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          {/* Expected close */}
          {deal.expected_close && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected Close</Label>
              <Input
                value={deal.expected_close}
                readOnly
                className="h-8 text-sm text-muted-foreground"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => {
                if (notes) patchDeal({ notes })
              }}
              placeholder="Add notes..."
              className="text-sm min-h-[100px]"
            />
          </div>

          <Separator />

          {/* Convert to Invoice — only for Won deals */}
          {deal.status === "won" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This deal is won. Convert it to an invoice to begin billing.
              </p>
              <Button
                onClick={() => convertToInvoice()}
                disabled={isConverting}
                className="w-full"
              >
                {isConverting ? "Converting..." : "Convert to Invoice"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
