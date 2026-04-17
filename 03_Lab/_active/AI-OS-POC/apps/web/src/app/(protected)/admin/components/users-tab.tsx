"use client"
// apps/web/src/app/(protected)/admin/components/users-tab.tsx
// Users management table: inline role dropdown + Suspend button + InviteUserDialog

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AdminUser } from "@/types/api"
import { InviteUserDialog } from "./invite-user-dialog"

const ASSIGNABLE_ROLES = ["admin", "manager", "finance", "pm", "team_member", "client"] as const

export function UsersTab() {
  const queryClient = useQueryClient()

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/bff/admin/users").then((r) => r.json()),
    staleTime: 30_000,
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await fetch(`/api/bff/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to update role")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  const suspendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bff/admin/users/${id}/suspend`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to suspend user")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  function handleSuspend(user: AdminUser) {
    if (window.confirm(`Suspend ${user.name}?`)) {
      suspendMutation.mutate(user.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex justify-end">
        <InviteUserDialog
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          )}
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>
                <Select
                  value={user.role ?? "none"}
                  onValueChange={(v) => {
                    if (v !== "none") {
                      roleMutation.mutate({ id: user.id, role: v })
                    }
                  }}
                  disabled={roleMutation.isPending}
                >
                  <SelectTrigger className="w-36 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {user.is_active ? (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive">Suspended</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!user.is_active || suspendMutation.isPending}
                  onClick={() => handleSuspend(user)}
                >
                  Suspend
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
