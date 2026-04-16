# Business Info — Onnex AI Agency

## Company
**Onnex** — AI Agency delivering AI-assisted Operating Systems to SME clients.

## Mission
Replace fragmented tools and manual processes with unified AI-powered operating systems. Every client gets a system that audits their current state, transforms their workflows, optimizes over time, and maintains itself.

## Delivery Framework
- **ATOM:** Audit → Transform → Optimize → Maintain
- **QDOAA Gates:** Quality, Delivery, Operations, Analytics, Adoption

## Pricing Model
- Build: $40K–$80K per vertical AI-OS deployment
- MRR: $2K–$5K per client for ongoing operations
- Target: 10+ clients across 3–4 verticals = $500K+ ARR

## Active Verticals

| Vertical | Product | Stage |
|----------|---------|-------|
| PI Law Firms | PI Growth OS | Active development |
| NDT / Aerospace | ndtv1 (NDT Portal) | Active development |
| MSPs | MSP AI-OS | Planned |
| Medical | Medical AI-OS | Planned |

## Active Products

**PI Growth OS** — Vertical SaaS for PI law firms (5–20 attorney practices).
Covers: intake automation, speed-to-lead, missed call recovery, case management, settlement tracking, Twilio/TCPA compliance.
Stack: Next.js, FastAPI, PostgreSQL/pgvector, Temporal, Hasura, Twilio.

**ndtv1 (NDT Portal)** — Three-service pipeline for NDT document processing.
Services: ndtv1-comply (ITAR-aware), ndtv1-sanitize, ndtv1-gateway.
Universal two-stage LLM pipeline: Stage 1 classifies part type + geometry; Stage 2 runs RT analysis.
Stack: Next.js 14 App Router, R3F/drei, FastAPI, Temporal, PostgreSQL/pgvector, Hasura, Anthropic SDK + Ollama fallback.

**ATOMIC-AI-BP-Discovery** — Multi-tenant SaaS for collaborative AI-powered business process discovery.
Roles: Superadmin (Onnex) → Chief Liaison → Team Lead → End User.
Features: voice transcription, screenshots, React Flow BPMN views, AI sidebar via OpenRouter.

**Agency-OS** — Onnex internal operating system (8 Figure Agency framework integrated).
13-system framework mapped to ATOM phases and QDOAA gates.

## Infrastructure
Self-hosted on Proxmox homelab (botonomy.xyz):
- GitLab: gitlab.botonomy.xyz (port 2222)
- n8n: n8n.botonomy.xyz
- claude-controller VM: Tailscale 100.111.233.126 (Ansible + Claude Code orchestration)
- Dual RTX 3090 + Ollama for local LLM inference

## Sales Motion
- Discovery via ShareCRM partnership (NDT vertical)
- Speed-to-lead as primary hook for PI law firms
- AI maturity assessment (System A) as entry point for new verticals