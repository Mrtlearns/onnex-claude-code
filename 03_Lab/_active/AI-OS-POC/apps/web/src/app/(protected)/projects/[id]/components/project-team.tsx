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
import type { ProjectMember, AdminUser } from "@/types/api"

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
    queryFn: () => fetch(`/api/bff/projects/${projectId}/members`).then(r => r.json()),
    staleTime: 30_000,
  })

  const { data: allUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/bff/admin/users").then(r => r.json()),
    staleTime: 120_000,
    enabled: showAdd,
  })

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

  const handleAdd = () => {
    if (!selectedUserId) return
    const user = allUsers.find(u => u.id === selectedUserId)
    addMutation.mutate({
      user_id: selectedUserId,
      user_name: user?.name ?? selectedUserId,
      role: selectedRole,
    })
  }

  const existingIds = new Set(members.map(m => m.user_id))
  const availableUsers = allUsers.filter(u => !existingIds.has(u.id))

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
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
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
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
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
        <div className="space-y-2">
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border/50 hover:bg-muted/30 transition-colors"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={member.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs bg-primary/15">
                  {(member.user_name || member.user_id).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.user_name || member.user_id}</p>
                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
              </div>
              {member.logged_minutes > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {(member.logged_minutes / 60).toFixed(1)}h
                </div>
              )}
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
          ))}
        </div>
      )}
    </div>
  )
}
