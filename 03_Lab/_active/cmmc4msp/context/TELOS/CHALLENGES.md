# Challenges

## C1: Claude Assessment Accuracy
- **Impact:** False positives/negatives undermine trust and compliance integrity
- **Approach:** Detailed acceptable_proof_guidance per control seeded from CMMC Information Institute data; MSP override capability; confidence scores for triage
- **Status:** Active — first real assessments run, verdict quality looks reasonable (partial for brief policy doc, expected)

## C2: SPRS Scoring Edge Cases
- **Impact:** Incorrect SPRS scores could lead clients to submit wrong data to DoD
- **Approach:** Control 3.12.4 (SSP) global gate rule hardcoded; DoD score values (1/3/5) seeded; SPRS service tested
- **Status:** Core logic in place; needs validation against known-good spreadsheet

## C3: Multi-Tenant Data Isolation
- **Impact:** Client orgs must never see each other's data
- **Approach:** Hasura row-level permissions by org_id/msp_id from JWT; Authentik group-based roles; MinIO paths include org_id
- **Status:** Implemented and tested — msp_admin_B cannot see msp_admin_A's orgs (403)

## C4: n8n Workflow Persistence
- **Impact:** DB-patched workflow nodes will be lost if n8n is reinstalled
- **Approach:** Export patched workflows as JSON and commit to repo; document fix scripts in `scripts/`
- **Status:** Resolved — workflow 02 exported from live n8n API and committed to `n8n/workflows/02_artifact_submitted.json` (2026-04-16)
