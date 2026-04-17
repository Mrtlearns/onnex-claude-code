"use client"
// apps/web/src/app/(protected)/clients/[id]/client-detail-client.tsx
// Client Component — renders client detail with contacts panel + linked projects

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
import { ContactsPanel } from "../components/contacts-panel"
import { ClientForm } from "../components/client-form"
import type { Client, Project } from "@/types/api"

interface ClientDetailClientProps {
  clientId: string
}

export function ClientDetailClient({ clientId }: ClientDetailClientProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["client", clientId],
    queryFn: () =>
      fetch(`/api/bff/clients/${clientId}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load client")
        return r.json()
      }),
    staleTime: 60_000,
  })

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", { client_id: clientId }],
    queryFn: () =>
      fetch(`/api/bff/projects?client_id=${clientId}`).then((r) => r.json()),
    staleTime: 60_000,
  })

  const archiveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/bff/clients/${clientId}/archive`, { method: "PATCH" }).then((r) => {
        if (!r.ok) throw new Error("Archive failed")
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      router.push("/clients")
    },
  })

  if (clientLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!client) {
    return <p className="text-muted-foreground">Client not found.</p>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <Badge>{client.status}</Badge>
            {client.archived_at && (
              <Badge variant="secondary">Archived</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {client.type} client
            {client.billing_address ? ` · ${client.billing_address}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          {!client.archived_at && (
            <Button
              variant="destructive"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactsPanel
            clientId={client.id}
            contacts={client.contacts ?? []}
          />
        </CardContent>
      </Card>

      {/* Linked Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !projects || projects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No projects linked to this client.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {project.budget
                        ? `$${project.budget.toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            client={client}
            onSuccess={() => {
              setShowEdit(false)
              queryClient.invalidateQueries({ queryKey: ["client", clientId] })
            }}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
