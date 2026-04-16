# PI Lawyer OS — Neo4j Graph Schema

> Source: ChatGPT blueprint + Onnex decisions. Locked 2026-03-16.

---

## Why Neo4j?

Postgres handles transactional data (leads, cases, communications). Neo4j handles **relationship traversal** — finding paths, networks, and influence that are expensive or complex in relational SQL:

- Which partners refer the most leads?
- Which leads came from the same referral chain?
- Which attorney handles the most high-value cases?
- What is the referral network depth of a given partner?

---

## Phase 1 Nodes

```cypher
// Law firm (tenant root)
(:Firm {
  id: UUID,
  name: String,
  slug: String
})

// Prospective client / lead
(:Lead {
  id: UUID,
  firm_id: UUID,
  name: String,
  phone: String,
  status: String,     // new, contacted, intake-in-progress, signed, lost
  created_at: DateTime
})

// Attorney at a firm
(:Attorney {
  id: UUID,
  firm_id: UUID,
  name: String,
  email: String
})

// Referral partner (medical provider, other attorney, chiropractor, etc.)
(:Partner {
  id: UUID,
  firm_id: UUID,
  name: String,
  type: String,       // attorney, medical-provider, chiropractor, other
  phone: String
})
```

---

## Phase 1 Relationships

```cypher
// Lead was referred by a partner
(l:Lead)-[:REFERRED_BY {date: DateTime}]->(p:Partner)

// Lead assigned to attorney for follow-up
(l:Lead)-[:ASSIGNED_TO {assigned_at: DateTime}]->(a:Attorney)

// Firm owns all entities
(f:Firm)-[:HAS_LEAD]->(l:Lead)
(f:Firm)-[:HAS_ATTORNEY]->(a:Attorney)
(f:Firm)-[:HAS_PARTNER]->(p:Partner)
```

---

## Phase 2 Additions (when cases are added)

```cypher
// Active case node
(:Case {
  id: UUID,
  firm_id: UUID,
  case_number: String,
  case_type: String,
  sol_date: Date,
  status: String
})

// Lead became a signed case
(l:Lead)-[:BECAME {signed_at: DateTime}]->(c:Case)

// Case handled by attorney
(c:Case)-[:HANDLED_BY]->(a:Attorney)

// Partner referred the case (through the lead)
(p:Partner)-[:REFERRED]->(c:Case)
```

---

## Phase 4 Additions (Revenue Growth)

```cypher
// Partners know each other (referral network)
(p1:Partner)-[:KNOWS]->(p2:Partner)

// Lead came from another lead (word of mouth)
(l2:Lead)-[:CAME_FROM]->(l1:Lead)
```

---

## Key Queries

```cypher
// Top referral partners for a firm (Phase 1)
MATCH (f:Firm {id: $firm_id})-[:HAS_LEAD]->(l:Lead)-[:REFERRED_BY]->(p:Partner)
RETURN p.name, count(l) as lead_count
ORDER BY lead_count DESC
LIMIT 10;

// Find all leads from a specific partner
MATCH (p:Partner {id: $partner_id})<-[:REFERRED_BY]-(l:Lead)
RETURN l;

// Attorney workload
MATCH (a:Attorney {firm_id: $firm_id})<-[:ASSIGNED_TO]-(l:Lead)
RETURN a.name, count(l) as assigned_leads
ORDER BY assigned_leads DESC;
```

---

## Sync Strategy

Neo4j is **not** the primary write target. Postgres is. Data flows into Neo4j via:

1. n8n workflow: when a lead is created in Postgres → create (:Lead) node in Neo4j
2. n8n workflow: when a lead is assigned → create (l)-[:ASSIGNED_TO]->(a) relationship
3. n8n workflow: when referral source captured → create (l)-[:REFERRED_BY]->(p) relationship

This keeps Postgres as the authoritative system and Neo4j as the relationship/analytics layer.
