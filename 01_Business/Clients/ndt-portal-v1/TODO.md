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
