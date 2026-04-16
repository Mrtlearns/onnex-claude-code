# Strategies

## S1: TDD-First for Every Phase
Every phase starts with failing test scaffolds (RED) before any implementation. This enforces specification clarity before building and produces a living test suite that proves the platform works. Use `/tdd` or `/gsd:execute-phase` to enforce discipline.

## S2: GSD Workflow for Phase Governance
Each numbered phase follows the GSD loop: `plan-phase → execute-phase → verify-work → complete-milestone`. No phase starts without a plan. No phase closes without verification. Plans live in `.planning/phases/<phase-name>/`.

## S3: Deploy-and-Verify Loop
After each phase, deploy to the Agency-POC VM and run smoke tests against the live stack. Don't let uncommitted or undeployed work pile up. The VM is the source of truth for "does it actually work."

## S4: Minimal Surface, Maximum Function
No ORM, no Redux, no unnecessary abstractions. Raw SQL, Zustand for UI state only, TanStack Query for server state. Every addition must earn its place — YAGNI enforced.

## S5: Multi-Tenancy Non-Negotiable
`tenant_id` on every record, `requireTenant` middleware on every route, RBAC at both Next.js route guard (UX) and Fastify preHandler (security) levels. This is not a feature — it's the foundation. Never compromise it for convenience.
