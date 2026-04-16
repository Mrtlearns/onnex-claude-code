# Challenges

## C1: Zero-to-Full-Stack in 7 Days
- **Impact:** High execution risk — the frontend exists but there is zero backend. Auth, DB schema, Supabase edge functions, and AI integration all need to be built and wired in one sprint. Any phase running long cascades into the next.
- **Approach:** Phase-gated delivery — DB + Auth → Replace Mocks → AI Edge Functions → Cleanup. Each phase is independently shippable. Ruthless scope control: keep the scoring engine and design system untouched.
- **Strategy ref:** S1 (speed), S3 (self-hosted infra)

## C2: Distribution, AI Report Quality, and Differentiation
- **Impact:** A working product that generates generic AI summaries and is invisible to the market produces no revenue. Other AI maturity tools exist. The platform must stand out both on output quality and on reach.
- **Approach:** (1) Invest in Claude prompt quality for executive summaries and narratives — outputs must be specific to the org's scores, not boilerplate. (2) Build the shareable report and marketing asset during the MVP sprint so distribution can begin day one. (3) Anchor differentiation on the internal report (costing, syllabus, engagement scoping) — that is Onnex's edge, not the assessment itself.
- **Strategy ref:** S2 (vertical-first), S4 (assessment as entry hook)
