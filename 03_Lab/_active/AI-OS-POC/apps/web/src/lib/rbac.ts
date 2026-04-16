// apps/web/src/lib/rbac.ts
// Single source of truth for RBAC permission matrix
// Shared between middleware, layouts, RoleGate, and Fastify API

export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "team_member"
  | "contractor"
  | "finance"
  | "client_viewer"

// Authentik group names → application roles
// Group names must match what exists in Authentik
const GROUP_ROLE_MAP: Record<string, UserRole> = {
  "aios-super-admins": "super_admin",
  "aios-admins":       "admin",
  "aios-managers":     "manager",
  "aios-team":         "team_member",
  "aios-contractors":  "contractor",
  "aios-finance":      "finance",
  "aios-clients":      "client_viewer",
}

// Priority order: higher-privilege roles take precedence
const ROLE_PRIORITY: UserRole[] = [
  "super_admin", "admin", "manager", "finance", "team_member", "contractor", "client_viewer",
]

export function mapGroupsToRole(groups: string[]): UserRole {
  for (const role of ROLE_PRIORITY) {
    const groupName = Object.entries(GROUP_ROLE_MAP).find(([, r]) => r === role)?.[0]
    if (groupName && groups.includes(groupName)) return role
  }
  return "team_member" // safe default — lowest internal privilege
}

// Permission matrix: what each role can do
export const PERMISSIONS: Record<UserRole, string[]> = {
  super_admin:   ["*"],
  admin:         ["manage:all", "read:all", "write:all"],
  manager:       ["read:all", "write:clients", "write:projects", "write:tasks", "write:deals", "read:reports"],
  team_member:   ["read:all", "write:tasks", "read:documents"],
  contractor:    ["read:assigned", "write:assigned_tasks"],
  finance:       ["read:all", "write:invoices", "write:deals", "read:reports"],
  client_viewer: ["read:own_portal"],
}

export function canAccess(role: UserRole | undefined, permission: string): boolean {
  if (!role) return false
  const perms = PERMISSIONS[role] ?? []
  return perms.includes("*") || perms.includes("manage:all") || perms.includes(permission)
}
