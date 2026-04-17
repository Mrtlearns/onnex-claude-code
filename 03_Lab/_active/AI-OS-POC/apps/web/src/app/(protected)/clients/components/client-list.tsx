"use client"
// apps/web/src/app/(protected)/clients/components/client-list.tsx
// Interactive client list — URL-synced search, status filter, archived toggle, create dialog

import { useCallback, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientForm } from "./client-form"
import type { Client } from "@/types/api"

interface ClientListProps {
  initialSearch: { q?: string; status?: string; archived?: string }
}

const STATUS_OPTIONS = ["All", "Active", "Prospect", "Churned"] as const

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const timerRef = { current: null as ReturnType<typeof setTimeout> | null }

  const update = useCallback(
    (v: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setDebounced(v), delay)
    },
    [delay],
  )

  // Update on value change
  if (debounced !== value) {
    update(value)
  }

  return debounced
}

export function ClientList({ initialSearch }: ClientListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "")

  const activeStatus = searchParams.get("status") ?? "All"
  const includeArchived = searchParams.get("archived") === "true"

  // Build query params from URL
  const params = new URLSearchParams()
  const q = searchParams.get("q")
  if (q) params.set("q", q)
  if (activeStatus !== "All") params.set("status", activeStatus)
  if (includeArchived) params.set("archived", "true")

  const { data: rawClients, isLoading } = useQuery<Client[]>({
    queryKey: ["clients", Object.fromEntries(params)],
    queryFn: () =>
      fetch(`/api/bff/clients?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load clients")
        return r.json()
      }),
    staleTime: 60_000,
  })

  // Client-side filter as reliable fallback for the search term
  const clientSearch = searchInput.toLowerCase().trim()
  const clients = clientSearch && rawClients
    ? rawClients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch) ||
        (c.type ?? "").toLowerCase().includes(clientSearch)
      )
    : rawClients

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bff/clients/${id}/archive`, { method: "PATCH" }).then((r) => {
        if (!r.ok) throw new Error("Archive failed")
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  })

  const updateUrl = (updates: Record<string, string | undefined>) => {
    const current = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "") {
        current.delete(key)
      } else {
        current.set(key, val)
      }
    }
    router.push(`/clients?${current.toString()}`, { scroll: false })
  }

  const handleSearch = (value: string) => {
    setSearchInput(value)
    // Debounce by scheduling URL update
    setTimeout(() => updateUrl({ q: value || undefined }), 300)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={() => setShowCreate(true)}>New Client</Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search clients..."
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeArchived}
              onChange={(e) => updateUrl({ archived: e.target.checked ? "true" : undefined })}
            />
            Include archived
          </label>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={activeStatus} onValueChange={(v) => updateUrl({ status: v === "All" ? undefined : v })}>
        <TabsList>
          {STATUS_OPTIONS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No clients found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className={client.archived_at ? "opacity-60" : ""}>
                <TableCell>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium hover:underline"
                  >
                    {client.name}
                  </Link>
                  {client.archived_at && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Archived
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{client.type}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      client.status === "Active"
                        ? "default"
                        : client.status === "Prospect"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {client.status}
                  </Badge>
                </TableCell>
                <TableCell>{client.contacts?.length ?? 0}</TableCell>
                <TableCell>
                  {new Date(client.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditClient(client)}
                  >
                    Edit
                  </Button>
                  {!client.archived_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => archiveMutation.mutate(client.id)}
                      disabled={archiveMutation.isPending}
                    >
                      Archive
                    </Button>
                  )}
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
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSuccess={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editClient && (
            <ClientForm
              client={editClient}
              onSuccess={() => setEditClient(null)}
              onCancel={() => setEditClient(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
