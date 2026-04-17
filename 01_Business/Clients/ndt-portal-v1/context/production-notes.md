# NDT Portal v1 — Production Notes

> Operational notes, data gaps, and maintenance procedures for the live UT pipeline.
> Update this file after any production change, data fix, or operational finding.
> Last updated: 2026-04-17

---

## Data Gaps

### `ut.materials` — Missing Class AA Rates

**Status:** Open — non-blocking (code has correct fallback)

| Material     | `class_a_rate_per_lb` | `class_aa_rate_per_lb` | Action Needed |
|--------------|----------------------|------------------------|---------------|
| Aluminum     | set                  | **NULL**               | Fill in        |
| Mild Steel   | set                  | **NULL**               | Fill in        |

**Behaviour when NULL:** `computeWeight()` in `api/src/calculations/ut.ts` falls back to `class_a_rate_per_lb` for Class AA jobs. This means Class AA Aluminum and Mild Steel jobs are currently priced at the Class A rate — quotes will be **under-priced** if rates differ.

**Fix:**
```sql
UPDATE ut.materials SET class_aa_rate_per_lb = <correct_rate>
WHERE name IN ('Aluminum', 'Mild Steel');
```

**When it matters:** Only affects weight-based pricing (`useWeightPricing: true`) on these two materials for Class AA inspection. Time-based pricing (the default) is unaffected.

---

## Maintenance Procedures

### Live Dry-Run — Post-Change Verification

After any formula change in `api/src/calculations/ut.ts` or DB changes to `ut.customers` / `ut.global_settings`, run the live dry-run to verify all invariants still hold:

```bash
# Copy script into container (if not already present — CI deploys it automatically)
docker cp scripts/ut-live-dryrun.mjs ndt-portal-api-1:/app/scripts/

# Run from host via SSH
ssh -i ~/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 -i /opt/claude-workspace/keys/claude-controller-key \
   'docker exec ndt-portal-api-1 node /app/scripts/ut-live-dryrun.mjs'"

# Or from inside the API container directly
docker exec ndt-portal-api-1 node /app/scripts/ut-live-dryrun.mjs
```

**What it checks:** 127 invariant assertions across all 30 active customers × 6 geometry types. Exits 0 on pass, 1 on any failure.

**Scripts location:** `scripts/ut-live-dryrun.mjs` (live DB) · `scripts/ut-dryrun.mjs` (no DB, pure calc)

---

### Test Quote Seeder — Multi-Customer Coverage

The `scripts/ut-seed-test-quotes.mjs` script inserts 6 representative test quotes (one per geometry type) for every active customer except PREMCO (which already has 50+ real quotes). This ensures the inbox dashboard, rule engine reporting, and PDF generation all have multi-customer data to exercise.

```bash
# Copy and run inside API container
docker cp scripts/ut-seed-test-quotes.mjs ndt-portal-api-1:/app/scripts/
docker exec ndt-portal-api-1 node /app/scripts/ut-seed-test-quotes.mjs
```

**Coverage:** 29 customers × 6 geometries = 174 seed quotes. All tagged `requested_by = 'seed-script'`.

**Re-seed (wipe and re-insert):**
```sql
DELETE FROM ut.incoming_quotes WHERE requested_by = 'seed-script';
```
Then re-run the script.

**Do not delete real quotes** — production quotes have `requested_by` values of `test`, `email`, or NULL.

---

## Known Limitations

| Limitation | Location | Notes |
|------------|----------|-------|
| TUBING rate hardcoded at $250 | `ut.ts: rateForGeometry()` | Not per-customer configurable. Intentional — matches pricing model. Update function if customer-specific TUBING rates are needed. |
| `simple` lot pattern customers have no minimum enforcement | `ut.ts: computeLot()` | Intentional. Customers on `simple` pattern (ALLOY METALS, AVIATION METALS, LEADING EDGE, LEAN MFG, MCNEELEY, PROGRESSIVE ALLOY, Q&L, RAM, RICKARD, SA AEROSPACE, SIERRA, TOOLCRAFT, TRUE STEEL) never hit a minimum floor. |
| RING uses `Math.PI`; ROUND_BAR/TUBING use `ROUND_PI = 3.14` | `ut.ts` | Intentional — matches Excel spreadsheet baseline. Do not change without re-validating all customer quotes. |
| Authentik INTERNAL_SECRET is empty string | `.env` on ndtv1 | Internal service bypass is disabled. All API calls require a valid JWT. Use the API container directly for DB-level testing. |

---

## Quote Data Sources

| `source` value | Origin |
|----------------|--------|
| `email`        | Gmail ingestion pipeline (n8n WF-6) |
| `api`          | Direct API call or seed script |
| `salesforce`   | Salesforce CRM integration (n8n WF-3) |
| `portal`       | Customer-facing portal UI |

Real production quotes have `requested_by` values of `test`, `mrt@on-nex.com`, or NULL.
Seed script quotes use `requested_by = 'seed-script'` for easy identification and cleanup.
