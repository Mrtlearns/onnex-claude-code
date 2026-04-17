// apps/web/src/app/api/auth/[...nextauth]/route.ts
// next-auth v5 route handler
// IMPORTANT: do NOT add `export const runtime = "edge"` — Authentik OIDC requires Node.js runtime

import { handlers } from "../../../../auth"

export const { GET, POST } = handlers
