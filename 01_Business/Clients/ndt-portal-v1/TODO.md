# NDT Portal — To-Do

---

## Open Items

### Rules Tab — Customer Dropdown Only Shows Assigned Customers
**Priority:** Medium
**Reported:** 2026-04-11

**Issue:**
The customer dropdown in the Rules tab only shows customers explicitly assigned to the selected rule set (e.g. PREMCO rule set → only PREMCO appears). The other 29 customers have `rule_set_id = NULL` and are invisible in this view.

**Root cause:**
`api/src/routes/ut-rules.ts` — endpoint `GET /rule-sets/:id/customers` filters with:
```sql
SELECT id, name, rule_version_pin FROM ut.customers WHERE rule_set_id = $1 ORDER BY name
```

**Decision needed (MrT):**
What should this dropdown do?
- A) Show only explicitly assigned customers (current behaviour — keep as-is)
- B) Show all 30 customers (remove `WHERE rule_set_id = $1`)
- C) Show all customers with assignment status (needs JOIN + UI change)

**Files to change if B or C:**
- `api/src/routes/ut-rules.ts` — line ~232, the customers query
- Possibly `frontend/src/components/ut/rules/RuleSetEditor.tsx` — UI logic for unassigned customers

---

### UT Customers — Placeholder Rates to Confirm
**Priority:** Low
**Added:** 2026-04-17

5 customers inserted with `$225` standard defaults and `{"placeholder": true}` in `custom_variables`. Update rates when pricing is confirmed with each customer.

| Customer | Action needed |
|----------|--------------|
| CALIFORNIA AMFORGE | Confirm hourly rate, min charge, tech fee, lot pattern |
| iLAM PRECISION | Confirm hourly rate, min charge, tech fee, lot pattern |
| SUNSHINE METALS | Confirm hourly rate, min charge, tech fee, lot pattern |
| TECTON | Confirm hourly rate, min charge, tech fee, lot pattern |
| VELOCITY PRECISION | Confirm hourly rate, min charge, tech fee, lot pattern |

**How to update:** `UPDATE ut.customers SET hourly_rate=X, ... WHERE name='...'`
Remove the `placeholder` key from `custom_variables` once confirmed.

---

### UNIVERSAL METALS — `has_tech_fee` Flag vs Rule Expression
**Priority:** Low / Informational
**Added:** 2026-04-17

`has_tech_fee = false` on the UNIVERSAL METALS customer record is intentional — the v2 rule set bypasses this flag and applies `material.name == 'Nickel alloys' ? 125 : 0` directly in the lot_calculation expression. Do not flip `has_tech_fee` to `true` without also updating the rule expression, or the default rule path will double-charge the tech fee.

---
