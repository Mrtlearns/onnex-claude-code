import type { FastifyRequest, FastifyReply } from "fastify"

// Mirrors apps/web/src/lib/rbac.ts GROUP_ROLE_MAP exactly
const GROUP_ROLE_MAP: Record<string, string> = {
  "aios-super-admins": "super_admin",
  "aios-admins":       "admin",
  "aios-managers":     "manager",
  "aios-team":         "team_member",
  "aios-contractors":  "contractor",
  "aios-finance":      "finance",
  "aios-clients":      "client_viewer",
}

const ROLE_PRIORITY = [
  "super_admin", "admin", "manager", "finance", "team_member", "contractor", "client_viewer",
]

export function mapGroupsToRoleApi(groups: string[]): string {
  for (const role of ROLE_PRIORITY) {
    const groupName = Object.entries(GROUP_ROLE_MAP).find(([, r]) => r === role)?.[0]
    if (groupName && groups.includes(groupName)) return role
  }
  return "team_member"
}

export function requireRole(allowedRoles: string[]) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const jwtPayload = (request as FastifyRequest & { user?: Record<string, unknown> }).user
    if (!jwtPayload) {
      return reply.code(403).send({ error: "forbidden", message: "Not authenticated" })
    }

    // Derive role from groups if role claim not yet present
    let userRole = jwtPayload.role as string | undefined
    if (!userRole && Array.isArray(jwtPayload.groups)) {
      userRole = mapGroupsToRoleApi(jwtPayload.groups as string[])
    }

    if (!userRole) {
      return reply.code(403).send({ error: "forbidden", message: "No role claim in token" })
    }

    if (userRole === "super_admin") return // super_admin bypasses all checks

    if (!allowedRoles.includes(userRole)) {
      return reply.code(403).send({
        error: "forbidden",
        message: `Role '${userRole}' is not authorized. Required: ${allowedRoles.join(", ")}`,
      })
    }
  }
}
