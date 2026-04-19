"use client"
// apps/web/src/app/(protected)/admin/components/admin-client.tsx
// 2-tab layout: Users (super_admin only) | Audit Log (admin + super_admin)

import type { Session } from "next-auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersTab } from "./users-tab"
import { StaffTab } from "./staff-tab"
import { AuditLogTab } from "./audit-log-tab"
import { AiMemoryPanel } from "./ai-memory-panel"

interface AdminClientProps {
  session: Session | null
}

export function AdminClient({ session }: AdminClientProps) {
  const role = (session?.user as { role?: string } | undefined)?.role ?? ""
  const isSuperAdmin = role === "super_admin"

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Tabs defaultValue={isSuperAdmin ? "staff" : "audit-log"}>
        <TabsList>
          {isSuperAdmin && (
            <>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="users">Authentik Users</TabsTrigger>
            </>
          )}
          <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
          <TabsTrigger value="ai-memory">AI Memory</TabsTrigger>
        </TabsList>

        {isSuperAdmin && (
          <>
            <TabsContent value="staff">
              <StaffTab />
            </TabsContent>
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>
          </>
        )}

        <TabsContent value="audit-log">
          <AuditLogTab />
        </TabsContent>

        <TabsContent value="ai-memory">
          <div className="pt-4">
            <AiMemoryPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
