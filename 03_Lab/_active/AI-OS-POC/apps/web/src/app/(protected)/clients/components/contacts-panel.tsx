"use client"
// apps/web/src/app/(protected)/clients/components/contacts-panel.tsx
// Inline contacts table with add-contact form

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Contact } from "@/types/api"

interface ContactsPanelProps {
  clientId: string
  contacts: Contact[]
}

interface NewContact {
  name: string
  email: string
  phone: string
  role: string
}

export function ContactsPanel({ clientId, contacts }: ContactsPanelProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewContact>({ name: "", email: "", phone: "", role: "" })
  const [error, setError] = useState("")

  const addMutation = useMutation({
    mutationFn: async (data: NewContact) => {
      const res = await fetch(`/api/bff/clients/${clientId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to add contact")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] })
      setShowForm(false)
      setForm({ name: "", email: "", phone: "", role: "" })
      setError("")
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add contact")
    },
  })

  const handleAdd = () => {
    if (!form.name.trim()) {
      setError("Name is required")
      return
    }
    addMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Contacts</h3>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Contact"}
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-md p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Name *</label>
              <Input
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Role</label>
              <Input
                placeholder="CTO"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <Input
                type="email"
                placeholder="jane@acme.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Phone</label>
              <Input
                placeholder="+1 555-0100"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={addMutation.isPending}
          >
            {addMutation.isPending ? "Adding..." : "Add Contact"}
          </Button>
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No contacts yet. Add the first one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.role ?? "—"}</TableCell>
                <TableCell>
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                      {c.email}
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
