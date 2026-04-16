"use client"
// apps/web/src/app/(protected)/clients/components/client-form.tsx
// Create/Edit client form with Zod + React Hook Form validation

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { CreateClientSchema, type CreateClientInput, type Client } from "@/types/api"

interface ClientFormProps {
  client?: Client // if provided: edit mode
  onSuccess: () => void
  onCancel: () => void
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!client

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(CreateClientSchema),
    defaultValues: {
      name: client?.name ?? "",
      type: client?.type,
      status: client?.status ?? "Prospect",
      billing_address: client?.billing_address ?? "",
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: CreateClientInput) => {
      const url = isEdit ? `/api/bff/clients/${client!.id}` : "/api/bff/clients"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Save failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      onSuccess()
    },
  })

  const onSubmit = handleSubmit((data) => mutation.mutate(data))
  const typeValue = watch("type")
  const statusValue = watch("status")

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="client-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="client-name"
          aria-label="Name"
          placeholder="Acme Corp"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="client-type" className="text-sm font-medium">
          Type
        </label>
        <Select
          value={typeValue}
          onValueChange={(v) => setValue("type", v as CreateClientInput["type"], { shouldValidate: true })}
        >
          <SelectTrigger id="client-type" aria-label="Type">
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Agency">Agency</SelectItem>
            <SelectItem value="Direct">Direct</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-destructive">{errors.type.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="client-status" className="text-sm font-medium">
          Status
        </label>
        <Select
          value={statusValue}
          onValueChange={(v) => setValue("status", v as CreateClientInput["status"])}
        >
          <SelectTrigger id="client-status" aria-label="Status">
            <SelectValue placeholder="Select status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Prospect">Prospect</SelectItem>
            <SelectItem value="Churned">Churned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label htmlFor="client-billing" className="text-sm font-medium">
          Billing Address
        </label>
        <Textarea
          id="client-billing"
          aria-label="Billing Address"
          placeholder="123 Main St..."
          rows={3}
          {...register("billing_address")}
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
          {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Client"}
        </Button>
      </div>
    </form>
  )
}
