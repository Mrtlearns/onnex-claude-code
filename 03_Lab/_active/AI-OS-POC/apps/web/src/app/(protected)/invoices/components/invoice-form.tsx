"use client"
// apps/web/src/app/(protected)/invoices/components/invoice-form.tsx
// Create invoice form with Zod + React Hook Form validation

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CreateInvoiceSchema, type CreateInvoiceInput } from "@/lib/schemas"
import type { Client } from "@/types/api"

const NO_CLIENT = "__none__"

interface InvoiceFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
  const queryClient = useQueryClient()

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/bff/clients").then((r) => r.json()),
    staleTime: 60_000,
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(CreateInvoiceSchema),
    defaultValues: {
      tax_pct: 0,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: CreateInvoiceInput) => {
      const res = await fetch("/api/bff/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Create failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      onSuccess()
    },
  })

  const onSubmit = handleSubmit((data) => mutation.mutate(data))
  const clientValue = watch("client_id")

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Client */}
      <div className="space-y-1">
        <Label htmlFor="invoice-client" className="text-sm font-medium">
          Client
        </Label>
        <Select
          value={clientValue ?? NO_CLIENT}
          onValueChange={(v) =>
            setValue("client_id", v === NO_CLIENT ? "" : v, { shouldValidate: true })
          }
        >
          <SelectTrigger id="invoice-client" aria-label="Client">
            <SelectValue placeholder="Select client..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLIENT}>Select client...</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.client_id && (
          <p className="text-sm text-destructive">{errors.client_id.message}</p>
        )}
      </div>

      {/* Due Date */}
      <div className="space-y-1">
        <Label htmlFor="invoice-due-date" className="text-sm font-medium">
          Due Date
        </Label>
        <Input
          id="invoice-due-date"
          type="date"
          aria-label="Due Date"
          {...register("due_date")}
        />
      </div>

      {/* Tax Percent */}
      <div className="space-y-1">
        <Label htmlFor="invoice-tax" className="text-sm font-medium">
          Tax %
        </Label>
        <Input
          id="invoice-tax"
          type="number"
          min={0}
          max={100}
          step={0.01}
          aria-label="Tax %"
          {...register("tax_pct", { valueAsNumber: true })}
        />
        {errors.tax_pct && (
          <p className="text-sm text-destructive">{errors.tax_pct.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="invoice-notes" className="text-sm font-medium">
          Notes
        </Label>
        <Textarea
          id="invoice-notes"
          aria-label="Notes"
          placeholder="Payment terms, memo..."
          rows={3}
          {...register("notes")}
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Save failed"}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  )
}
