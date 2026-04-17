"use client"
// apps/web/src/app/(protected)/invoices/components/line-items-panel.tsx
// Line items table + T&M selector (loads unbilled time entries by project)
// Finance role only sees T&M panel

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import type { InvoiceLineItem, TimeEntry, Project } from "@/types/api"

const NO_PROJECT = "__none__"

interface LineItemsPanelProps {
  invoiceId: string
  isFinanceRole: boolean
}

interface NewLineItemRow {
  description: string
  qty: string
  rate: string
}

export function LineItemsPanel({ invoiceId, isFinanceRole }: LineItemsPanelProps) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState<NewLineItemRow>({ description: "", qty: "1", rate: "0" })

  // T&M state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [checkedEntries, setCheckedEntries] = useState<Set<string>>(new Set())
  const [hourlyRate, setHourlyRate] = useState("100")

  // Existing line items
  const { data: lineItems = [], isLoading } = useQuery<InvoiceLineItem[]>({
    queryKey: ["invoices", invoiceId, "line-items"],
    queryFn: () =>
      fetch(`/api/bff/invoices/${invoiceId}/line-items`).then((r) => {
        if (!r.ok) throw new Error("Failed to load line items")
        return r.json()
      }),
    staleTime: 60_000,
  })

  // Projects for T&M selector
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/bff/projects").then((r) => r.json()),
    staleTime: 60_000,
    enabled: isFinanceRole,
  })

  // Unbilled time entries for selected project
  const { data: timeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["invoices", invoiceId, "time-entries", selectedProjectId],
    queryFn: () =>
      fetch(`/api/bff/invoices/${invoiceId}/time-entries?project_id=${selectedProjectId}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load time entries")
        return r.json()
      }),
    enabled: !!selectedProjectId && isFinanceRole,
    staleTime: 30_000,
  })

  const addLineItemMutation = useMutation({
    mutationFn: (body: { description: string; qty: number; rate: number; time_entry_id?: string }) =>
      fetch(`/api/bff/invoices/${invoiceId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to add line item")
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId, "line-items"] })
    },
  })

  const handleAddManual = async () => {
    const qty = parseFloat(newItem.qty)
    const rate = parseFloat(newItem.rate)
    if (!newItem.description || isNaN(qty) || isNaN(rate)) return
    await addLineItemMutation.mutateAsync({ description: newItem.description, qty, rate })
    setNewItem({ description: "", qty: "1", rate: "0" })
    setShowAddForm(false)
  }

  const handleAddFromTimeEntries = async () => {
    const rate = parseFloat(hourlyRate)
    if (isNaN(rate)) return
    for (const entryId of checkedEntries) {
      const entry = timeEntries.find((e) => e.id === entryId)
      if (!entry) continue
      const qty = parseFloat((entry.duration_minutes / 60).toFixed(2))
      await addLineItemMutation.mutateAsync({
        description: entry.description,
        qty,
        rate,
        time_entry_id: entry.id,
      })
    }
    setCheckedEntries(new Set())
    queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId, "time-entries", selectedProjectId] })
  }

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading line items...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Line Items</h3>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          Add Line Item
        </Button>
      </div>

      {/* Existing line items */}
      {lineItems.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell className="text-right text-sm">{item.qty}</TableCell>
                <TableCell className="text-right text-sm">${item.rate.toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm font-medium">
                  ${(item.qty * item.rate).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No line items yet.</p>
      )}

      {/* Add line item inline form */}
      {showAddForm && (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Service description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newItem.qty}
                onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rate ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newItem.rate}
                onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={handleAddManual}
                disabled={addLineItemMutation.isPending}
                className="w-full"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* T&M section — Finance role only */}
      {isFinanceRole && (
        <div className="border rounded-md p-3 space-y-3 bg-blue-50/40">
          <h4 className="text-sm font-medium">Add from Time Entries (T&M)</h4>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Project</Label>
              <Select
                value={selectedProjectId || NO_PROJECT}
                onValueChange={(v) => {
                  setSelectedProjectId(v === NO_PROJECT ? "" : v)
                  setCheckedEntries(new Set())
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Select project...</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hourly Rate ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {selectedProjectId && timeEntries.length > 0 && (
            <div className="space-y-1">
              {timeEntries.map((entry) => (
                <label
                  key={entry.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checkedEntries.has(entry.id)}
                    onChange={(e) => {
                      const next = new Set(checkedEntries)
                      if (e.target.checked) next.add(entry.id)
                      else next.delete(entry.id)
                      setCheckedEntries(next)
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                  <span className="flex-1">{entry.description}</span>
                  <span className="text-xs font-medium">{formatDuration(entry.duration_minutes)}</span>
                </label>
              ))}
              <Button
                size="sm"
                onClick={handleAddFromTimeEntries}
                disabled={checkedEntries.size === 0 || addLineItemMutation.isPending}
                className="mt-2"
              >
                Add Selected ({checkedEntries.size})
              </Button>
            </div>
          )}

          {selectedProjectId && timeEntries.length === 0 && (
            <p className="text-sm text-muted-foreground">No unbilled time entries for this project.</p>
          )}
        </div>
      )}
    </div>
  )
}
