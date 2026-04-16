import { List, Shield, Users, ScrollText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { RequirePermission } from '../auth/RequireAuth'
import JobsTab from './JobsTab'
import RolesTab from './RolesTab'
import UsersTab from './UsersTab'
import AuditLogTab from './AuditLogTab'

export default function AdminApp() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System administration, role management, and audit logging.
        </p>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList className="mb-6">
          <TabsTrigger value="jobs" className="flex items-center gap-1.5">
            <List className="h-3.5 w-3.5" /> Jobs
          </TabsTrigger>
          <RequirePermission permission="RBAC_VIEW">
            <TabsTrigger value="roles" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Roles
            </TabsTrigger>
          </RequirePermission>
          <RequirePermission permission="RBAC_ADMIN">
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Users
            </TabsTrigger>
          </RequirePermission>
          <RequirePermission permission="RBAC_ADMIN">
            <TabsTrigger value="audit" className="flex items-center gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> Audit Log
            </TabsTrigger>
          </RequirePermission>
        </TabsList>

        <TabsContent value="jobs">
          <JobsTab />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
