# Demo Data

## What "Generate Demo Data" Creates

Navigate to **Settings → Demo Data → Generate Demo Data** to populate the system with a complete realistic dataset.

### Counts

| Entity | Count | Details |
|--------|-------|---------|
| Partners | 5 | Attorney, chiropractor ×2, medical, hospital |
| Leads | 12 | All statuses, incl. 3 resurrection candidates |
| Clients | 5 | Full insurance details per client |
| Cases | 5 | All lifecycle stages |
| Medical Providers | 14 | Spread across all 5 cases |
| Tasks | 15 | Mix of open/in-progress/completed |
| Communications | 26 | Note/call/sms/email mix |
| Documents | 19 | Retainer, medical, police report, settlement types |
| Demand Letters | 1 | Rodriguez case (demand stage) |
| Settlement Offers | 9 | 5-offer chain on Williams + Nguyen chain + Rodriguez demand |
| Case Costs | 13 | Filed across all cases |
| Settlements | 2 | Williams ($72k) + Nguyen ($100k policy limits) |
| Partner Referrals | 4 | With commission tracking |
| Portal Account | 1 | `portal@williams.demo` / `Portal2026!` |

---

## Partners (5)

| Name | Type |
|------|------|
| Johnson Legal Group | Attorney |
| Vegas Spine & Chiro | Chiropractor |
| Dr. Rachel Kim MD | Medical |
| NV Regional Medical Center | Hospital |
| Henderson Chiropractic & Wellness | Chiropractor |

---

## Cases — All Statuses Covered

| Case # | Client | Status | Notes |
|--------|--------|--------|-------|
| PI-2025-001 | Patricia Williams | negotiation | 5-offer chain, $72k accepted; documents + settlement |
| PI-2025-002 | Maria Rodriguez | demand | Demand letter to Allstate; $95k demand sent |
| PI-2025-003 | James Chen | investigation | Slip-fall; footage preserved; litigation imminent |
| PI-2025-004 | Marcus Harrison | pre-litigation | 18mo in, SOL 6mo out (2026-09-12); filing soon |
| PI-2024-009 | Lisa Nguyen | closed | Policy limits $100k; disbursement complete 4mo ago |

---

## Leads — All Statuses

| Name | Status | Notes |
|------|--------|-------|
| Patricia Williams | signed | Became case PI-2025-001 |
| Maria Rodriguez | new | Became case PI-2025-002 |
| James Chen | intake-in-progress | Became case PI-2025-003 |
| Marcus Harrison | signed | Became case PI-2025-004 |
| Lisa Nguyen | signed | Became case PI-2024-009 |
| Robert Thompson | contacted | Dog bite |
| Linda Davis | lost | Auto accident |
| Amir Patel | intake-in-progress | Motorcycle |
| Diana Brooks | contacted | Dog bite |
| Marcus Park | new | **Resurrection candidate** — 45 days, no comms |
| Sofia Torres | contacted | **Resurrection candidate** — cold 35 days ago |
| Elena Gomez | new | **Resurrection candidate** — 50 days, never contacted |

---

## Client Portal Account

- **Email:** `portal@williams.demo`
- **Password:** `Portal2026!`
- **Firm slug:** `demo`
- **Access:** Williams case (PI-2025-001)

---

## Reset Instructions

```
Settings → Clear All Data → type CLEAR → Generate Demo Data
```

Clearing and regenerating is idempotent — all IDs change but structure and counts are identical.
