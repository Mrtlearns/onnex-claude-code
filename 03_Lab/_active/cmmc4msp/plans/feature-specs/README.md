# CMMC Compliance OS — Feature Specifications

10 features: 5 product improvements + 5 AI-powered capabilities.
All specs written against codebase state 2026-04-17 (212 tests passing, MVP deployed).

---

## Product Improvements

| ID | Feature | Effort | Sprint | Doc |
|----|---------|--------|--------|-----|
| P1 | Real email delivery + digest infrastructure | S (2–3d) | Next | [P1-real-email-delivery.md](./P1-real-email-delivery.md) |
| P2 | Evidence-source integrations (Entra ID, Okta, Defender, CrowdStrike) | L per connector | Q2 (Entra first) | [P2-evidence-source-integrations.md](./P2-evidence-source-integrations.md) |
| P3 | C3PAO audit-package export + evidence chain-of-custody | M (1wk) | Q2 | [P3-audit-package-export.md](./P3-audit-package-export.md) |
| P4 | Evidence freshness / expiry monitoring + continuous re-assessment | M (4–5d) | Q2 | [P4-evidence-freshness-monitoring.md](./P4-evidence-freshness-monitoring.md) |
| P5 | Cross-client MSP analytics + benchmarking | M (1wk) | Q2 | [P5-msp-analytics-benchmarking.md](./P5-msp-analytics-benchmarking.md) |

## AI-Powered Features

| ID | Feature | Model | Effort | Sprint | Doc |
|----|---------|-------|--------|--------|-----|
| A1 | Conversational compliance copilot (per-control chat) | claude-sonnet-4-6 | M (1wk) | Next | [A1-compliance-copilot.md](./A1-compliance-copilot.md) |
| A2 | AI-drafted first-pass remediation policies | claude-opus-4-7 | M (1wk) | Next | [A2-ai-drafted-remediation-policies.md](./A2-ai-drafted-remediation-policies.md) |
| A3 | Evidence drift detection agent | claude-haiku-4-5 | S–M (3–5d) | Q2 | [A3-evidence-drift-detection.md](./A3-evidence-drift-detection.md) |
| A4 | Multi-artifact cross-control gap synthesis | claude-sonnet-4-6 | M (1wk) | Q2 | [A4-multi-artifact-gap-synthesis.md](./A4-multi-artifact-gap-synthesis.md) |
| A5 | SSP narrative generation via conversational interview | claude-sonnet-4-6 | M–L (1–2wk) | Q3 | [A5-ssp-narrative-generation.md](./A5-ssp-narrative-generation.md) |

---

## Recommended Build Order

```
Sprint 1 (Now):   P1 Email → A1 Copilot → A2 Policy Drafts
Sprint 2 (Q2):    P4 Freshness → A3 Drift → P3 Audit Package → P5 Analytics
Sprint 3 (Q2/Q3): P2 Entra ID → A4 Gap Synthesis → A5 SSP Narratives
```

## Shared Infrastructure Reused Across Features

| Asset | Used By |
|-------|---------|
| `embeddings_service.py` | A1, A3, A4 |
| `pgvector` (artifact_chunks, control_definition_embeddings) | A1, A3, A4 |
| `n8n_service.py` trigger pattern | A2, A3, P2 |
| OpenRouter API (existing credential) | A1, A2, A3, A4, A5 |
| `report_service.py` ReportLab patterns | P3, A4 (PDF export) |
| `activity_log` table | P3, A2, A5 |
| `assignment_events` | P3, P5 |
| Email infrastructure (P1) | A2 (review notify), A3 (drift alerts), P4 (expiry warns) |
| MinIO buckets (new: cmmc-drafts) | A2 |
| Hasura aggregations | P5 |

## New DB Objects Summary

| Migration | New Objects | Feature |
|-----------|------------|---------|
| 014 | `user_notification_preferences`, `email_log`, `users.email`, `users.unsubscribe_token` | P1 |
| 015 | `integrations`, `integration_credentials`, `integration_sync_log`, `artifacts.source_type` | P2 |
| 016 | `audit_packages`, `artifact_approvals` | P3 |
| 017 | `control_definitions.evidence_max_age_days`, `program_controls.last_evidence_at/expires_at/stale_since` | P4 |
| 018 | `control_chat_messages`, `nist_guide_chunks` | A1 |
| 019 | `policy_drafts` | A2 |
| 020 | `artifacts.baseline_embedding/drift_score/drift_status`, `artifact_drift_events` | A3 |
| 021 | `control_gap_analyses` | A4 |
| 022 | `ssp_interviews` | A5 |
