"use client"
// apps/web/src/app/(protected)/projects/components/project-list.tsx
// Interactive project list — URL-synced filters, create dialog

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectForm } from "./project-form"
import type { Client, Project } from "@/types/api"

interface ProjectListProps {
  initialSearch: { status?: string; client_id?: string; archived?: string }
}

const STATUS_OPTIONS = ["All", "Active", "Completed", "On Hold"] as const

export function ProjectList({ initialSearch: _initialSearch }: ProjectListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const activeStatus = searchParams.get("status") ?? "All"
  const clientFilter = searchParams.get("client_id") ?? ""
  const includeArchived = searchParams.get("archived") === "true"

  const params = new URLSearchParams()
  if (activeStatus !== "All") params.set("status", activeStatus)
  if (clientFilter) params.set("client_id", clientFilter)
  if (includeArchived) params.set("archived", "true")

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["projects", Object.fromEntries(params)],
    queryFn: () =>
      fetch(`/api/bff/projects?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load projects")
        return r.json()
      }),
    staleTime: 60_000,
  })

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["clients", {}],
    queryFn: () => fetch("/api/bff/clients").then((r) => r.json()),
    staleTime: 60_000,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bff/projects/${id}/archive`, { method: "PATCH" }).then((r) => {
        if (!r.ok) throw new Error("Archive failed")
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
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
    router.push(`/projects?${current.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>New Project</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={clientFilter || "all"}
          onValueChange={(v) => updateUrl({ client_id: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {(clients ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      {/* Status tabs */}
      <Tabs
        value={activeStatus}
        onValueChange={(v) => updateUrl({ status: v === "All" ? undefined : v })}
      >
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
      ) : !projects || projects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No projects found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id} className={project.archived_at ? "opacity-60" : ""}>
                <TableCell>
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                  {project.archived_at && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Archived
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{project.client_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      project.status === "Active"
                        ? "default"
                        : project.status === "Completed"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {project.budget ? `$${project.budget.toLocaleString()}` : "—"}
                </TableCell>
                <TableCell>
                  {project.start_date
                    ? new Date(project.start_date).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditProject(project)}
                  >
                    Edit
                  </Button>
                  {!project.archived_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => archiveMutation.mutate(project.id)}
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
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            onSuccess={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {editProject && (
            <ProjectForm
              project={editProject}
              onSuccess={() => setEditProject(null)}
              onCancel={() => setEditProject(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
