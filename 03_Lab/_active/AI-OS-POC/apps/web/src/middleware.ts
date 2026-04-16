// apps/web/src/middleware.ts
// Coarse auth gate — redirects unauthenticated users to /login
// IMPORTANT: This is NOT the security boundary. CVE-2025-29927 makes
// middleware-only role checks bypassable via x-middleware-subrequest header.
// Real authorization enforced in: (protected)/layout.tsx (auth check) + Fastify requireRole (API)

export { auth as middleware } from "@/auth"

export const config = {
  matcher: [
    // Match all paths except:
    // - Next.js internals and static assets
    // - Auth.js endpoints (api/auth)
    // - Authentik SSO paths proxied to authentik-server (application, flows, if, api/v3, static, .well-known)
    "/((?!_next/static|_next/image|favicon.ico|api/auth|application/|flows/|if/|api/v3/|static/|\\.well-known/).*)",
  ],
}
