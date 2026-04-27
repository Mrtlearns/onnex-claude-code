"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-team.tsx

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserPlus, Trash2, Users, Clock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProjectMember, StaffMember } from "@/types/api"

const PROJECT_ROLES = [
  { value: "lead",            label: "Lead" },
  { value: "project_manager", label: "Project Manager" },
  { value: "developer",       label: "Developer" },
  { value: "member",          label: "Member" },
  { value: "reviewer",        label: "Reviewer" },
  { value: "client",          label: "Client" },
  { value: "external",        label: "External" },
  { value: "observer",        label: "Observer" },
]

interface ProjectTeamProps {
  projectId: string
}

export function ProjectTeam({ projectId }: ProjectTeamProps) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState("member")

  const { data: members = [], isLoading } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", projectId],
    queryFn: () => fetch(`/api/bff/projects/${projectId}/members`)
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) ? d : []),
    staleTime: 30_000,
  })

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => fetch("/api/bff/staff")
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) ? d : []),
    staleTime: 120_000,
  })
  const staffById = new Map(staff.map(s => [s.user_id, s]))

  const addMutation = useMutation({
    mutationFn: ({ user_id, user_name, role }: { user_id: string; user_name: string; role: string }) =>
      fetch(`/api/bff/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, user_name, role }),
      }).then(r => {
        if (!r.ok) throw new Error("Failed to add member")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] })
      setShowAdd(false)
      setSelectedUserId("")
      setSelectedRole("member")
      toast.success("Member added")
    },
    onError: () => toast.error("Failed to add member"),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/bff/projects/${projectId}/members/${userId}`, { method: "DELETE" }).then(r => {
        if (!r.ok) throw new Error("Remove failed")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] })
      toast.success("Member removed")
    },
    onError: () => toast.error("Failed to remove member"),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      fetch(`/api/bff/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then(r => {
        if (!r.ok) throw new Error("Update failed")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] })
      toast.success("Role updated")
    },
    onError: () => toast.error("Failed to update role"),
  })

  const handleAdd = () => {
    if (!selectedUserId) return
    const member = staff.find(s => s.user_id === selectedUserId)
    addMutation.mutate({
      user_id: selectedUserId,
      user_name: member?.display_name ?? selectedUserId,
      role: selectedRole,
    })
  }

  const existingIds = new Set(members.map(m => m.user_id))
  const availableUsers = staff.filter(s => !existingIds.has(s.user_id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{members.length} team member{members.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Add Member
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">User</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.display_name}</SelectItem>
                    ))}
                    {availableUsers.length === 0 && (
                      <SelectItem value="_none" disabled>No users available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setSelectedUserId("") }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending || !selectedUserId}>
                {addMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading team...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No team members assigned. Click "Add Member" to get started.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {members.map((member) => {
                const s = staffById.get(member.user_id)
                const displayName = member.user_name || member.user_id
                const initials = displayName.slice(0, 2).toUpperCase()

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Larger avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={s?.avatar_url ?? member.avatar_url ?? undefined} />
                      <AvatarFallback className="text-sm font-medium bg-primary/15">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name + role selector */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateRoleMutation.mutate({ userId: member.user_id, role })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-6 text-xs px-1.5 py-0 border-0 shadow-none",
                            "hover:bg-muted/50 w-auto gap-1 text-muted-foreground font-normal capitalize",
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Logged hours badge */}
                    {member.logged_minutes > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-xs shrink-0 gap-1 font-normal"
                      >
                        <Clock className="h-3 w-3" />
                        {(member.logged_minutes / 60).toFixed(1)}h
                      </Badge>
                    )}

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeMutation.mutate(member.user_id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
