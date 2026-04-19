"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CreateDealSchema, type CreateDealInput } from "@/lib/schemas"
import type { Client } from "@/types/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { UserSelect } from "@/components/ui/user-select"

const NO_CLIENT = "__none__"

interface DealFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  dealId?: string
  defaultValues?: Partial<CreateDealInput>
}

export function DealForm({ onSuccess, onCancel, dealId, defaultValues }: DealFormProps) {
  const qc = useQueryClient()

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: () => fetch("/api/bff/clients").then(r => r.json()),
    staleTime: 60_000,
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateDealInput>({
    resolver: zodResolver(CreateDealSchema),
    defaultValues: {
      probability: 50,
      ...defaultValues,
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: CreateDealInput) => {
      const url = dealId ? `/api/bff/deals/${dealId}` : "/api/bff/deals"
      const method = dealId ? "PATCH" : "POST"
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] })
      onSuccess?.()
    },
  })

  return (
    <form
      onSubmit={handleSubmit(d => mutate(d))}
      className="space-y-4"
      aria-label="Deal form"
    >
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="deal-title" className="text-sm">
          Title <span aria-hidden>*</span>
        </Label>
        <Input
          id="deal-title"
          {...register("title")}
          placeholder="Deal title"
          className="h-9 text-sm"
          aria-label="Title"
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Client */}
      <div className="space-y-1.5">
        <Label className="text-sm">
          Client <span aria-hidden>*</span>
        </Label>
        <Select
          value={watch("client_id") ?? NO_CLIENT}
          onValueChange={val => setValue("client_id", val === NO_CLIENT ? "" : val)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLIENT} className="text-sm">Select a client</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id} className="text-sm">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.client_id && (
          <p className="text-xs text-destructive">{errors.client_id.message}</p>
        )}
      </div>

      {/* Value */}
      <div className="space-y-1.5">
        <Label htmlFor="deal-value" className="text-sm">
          Value ($) <span aria-hidden>*</span>
        </Label>
        <Input
          id="deal-value"
          type="number"
          min={0}
          step={100}
          {...register("value", { valueAsNumber: true })}
          placeholder="50000"
          className="h-9 text-sm"
        />
        {errors.value && (
          <p className="text-xs text-destructive">{errors.value.message}</p>
        )}
      </div>

      {/* Probability */}
      <div className="space-y-1.5">
        <Label htmlFor="deal-probability" className="text-sm">
          Probability (0–100) <span aria-hidden>*</span>
        </Label>
        <Input
          id="deal-probability"
          type="number"
          min={0}
          max={100}
          {...register("probability", { valueAsNumber: true })}
          placeholder="50"
          className="h-9 text-sm"
        />
        {errors.probability && (
          <p className="text-xs text-destructive">{errors.probability.message}</p>
        )}
      </div>

      {/* Expected Close */}
      <div className="space-y-1.5">
        <Label htmlFor="deal-close" className="text-sm">Expected Close (optional)</Label>
        <Input
          id="deal-close"
          type="date"
          {...register("expected_close")}
          className="h-9 text-sm"
        />
      </div>

      {/* Owner */}
      <div className="space-y-1.5">
        <Label className="text-sm">Owner (optional)</Label>
        <UserSelect
          value={watch("owner_id")}
          onChange={(v) => setValue("owner_id", v ?? null)}
          placeholder="No owner"
          className="h-9 text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : (dealId ? "Save" : "Create Deal")}
        </Button>
      </div>
    </form>
  )
}
