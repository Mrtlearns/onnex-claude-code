"use client"
// Staff directory tab — shows all user_profiles with role/status management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { StaffMember } from "@/types/api"
import { OnboardStaffDialog } from "./onboard-staff-dialog"

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export function StaffTab() {
  const qc = useQueryClient()

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => fetch("/api/bff/staff").then((r) => r.json()),
    staleTime: 30_000,
  })

  const archiveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/bff/admin/staff/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      })
      if (!res.ok) throw new Error("Failed to archive staff member")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  })

  function handleArchive(member: StaffMember) {
    if (window.confirm(`Archive ${member.display_name}? They will lose access.`)) {
      archiveMutation.mutate(member.user_id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staff.length} member{staff.length !== 1 ? "s" : ""}</p>
        <OnboardStaffDialog onSuccess={() => qc.invalidateQueries({ queryKey: ["staff"] })} />
      </div>

      {staff.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          No staff members yet. Click <strong>Add Staff</strong> to onboard your first team member.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.user_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {initials(member.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{member.display_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {member.job_title ?? <span className="italic">—</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {member.timezone ?? <span className="italic">—</span>}
                </TableCell>
                <TableCell>
                  {member.status === "active" ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
                  ) : member.status === "archived" ? (
                    <Badge variant="secondary">Archived</Badge>
                  ) : (
                    <Badge variant="outline">{member.status}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={member.status === "archived" || archiveMutation.isPending}
                    onClick={() => handleArchive(member)}
                  >
                    Archive
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
