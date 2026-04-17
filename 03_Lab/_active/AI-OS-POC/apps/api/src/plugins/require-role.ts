// apps/api/src/plugins/require-role.ts
// Fastify preHandler: asserts the authenticated user has one of the allowed roles

import type { FastifyRequest, FastifyReply } from 'fastify'

// Maps Authentik group names to application roles (must match apps/web/src/lib/rbac.ts)
const GROUP_ROLE_MAP: Record<string, string> = {
  'aios-super-admins': 'super_admin',
  'aios-admins':       'admin',
  'aios-managers':     'manager',
  'aios-team':         'team_member',
  'aios-contractors':  'contractor',
  'aios-finance':      'finance',
  'aios-clients':      'client_viewer',
}

const ROLE_PRIORITY = ['super_admin', 'admin', 'manager', 'finance', 'team_member', 'contractor', 'client_viewer']

function resolveRole(user: any): string {
  // Direct role claim (e.g. set via Authentik property mapping)
  if (user?.role) return user.role as string
  // Map from groups array (standard Authentik JWT)
  const groups: string[] = Array.isArray(user?.groups) ? user.groups : []
  const mapped = groups.map(g => GROUP_ROLE_MAP[g]).filter(Boolean)
  for (const r of ROLE_PRIORITY) {
    if (mapped.includes(r)) return r
  }
  return ''
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = resolveRole((request as any).user)
    if (!roles.includes(userRole)) {
      return reply.code(403).send({ error: 'Forbidden — insufficient role' })
    }
  }
}
