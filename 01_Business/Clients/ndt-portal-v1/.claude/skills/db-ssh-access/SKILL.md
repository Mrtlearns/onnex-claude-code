# Skill: NDT Portal — DB SSH Access (Lean Path)

> **When to use:** Any time you need to query, inspect, or export data from the ndtportal PostgreSQL database.
> This skill documents the exact working pattern derived from trial-and-error on 2026-04-20. Follow it exactly — do not deviate.

---

## The Working Pattern

### Connection chain
```
Local (Windows/bash) → Controller (100.111.233.126) → Server (10.10.110.32) → Docker container
```

### SSH key — MUST use absolute path
```bash
# CORRECT — absolute /c/ path works in bash on Windows
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126

# WRONG — tilde path fails silently or uses wrong key
ssh -i ~/.ssh/MrT_Personal_Key_ed25519 ...

# WRONG — ProxyJump (-J) without explicit key fails auth on controller
ssh -J mrt@100.111.233.126 mrt@10.10.110.32 ...
```

### Two-hop SSH template
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 '<command>'"
```

The inner command uses **single quotes** on the outer SSH string. This avoids nested quoting hell.

---

## Database Credentials

| Field | Value |
|-------|-------|
| Container | `ndt-portal-postgres-1` |
| User | `ndtapp` |
| Database | `ndtportal` |
| Schemas | `app`, `auth`, `pipeline`, `rt`, `sf`, `ut`, `ut_rules`, `workshop` |

**WRONG containers** (don't exist or are wrong DB): `ndt-portal-db-1`, `ndt-portal-authentik-db-1`
**WRONG users**: `postgres`, `ndt` — neither role exists in this container.

---

## Query Templates

### Simple meta-command (list tables, describe table)
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -c \"\d ut.customers\"'"
```

### SELECT query (no string literals in WHERE)
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -c \"SELECT id, name FROM ut.customers ORDER BY name;\"'"
```

### SELECT with string literals in WHERE — use a shell heredoc on the server
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -c \"\d ut.customers\"'"
```
For queries that need `WHERE table_schema = '\''ut'\''` style, prefer `\d schema.table` meta-commands instead of `information_schema` queries — they avoid quote escaping entirely.

### CSV dump (tab-separated, no headers, comma-delimited)
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -t -A -F\",\" -c \"SELECT col1,col2 FROM schema.table ORDER BY col1;\"'"
```
Flags: `-t` (tuples only, no header/footer), `-A` (unaligned), `-F","` (comma field separator).

### Schema dump (full DDL)
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 pg_dump -U ndtapp -d ndtportal --schema-only --no-owner --no-acl 2>&1'" \
  > "D:/Code/Claude/01_Business/Clients/ndt-portal-v1/files/ndtportal_schema_dump.sql"
```

---

## Quoting Rules (The Source of All Pain)

The shell processes quotes in layers. With two SSH hops, you have 3 layers:
1. Local bash
2. Controller bash
3. Server bash

**Safe pattern:** Outer double-quotes on local bash → inner single-quotes on controller → escaped double-quotes `\"` for SQL inside.

```bash
# Layer structure:
ssh ...controller... "ssh ...server... 'docker exec ... psql ... -c \"SQL HERE\"'"
#                    ^outer double      ^inner single        ^escaped double for SQL
```

**Never do:** Nested single-quotes inside a single-quoted string. It breaks bash parsing with "unexpected EOF" errors.
**Never do:** `information_schema` queries with `WHERE table_schema='ut'` across two SSH hops — the single quotes get eaten. Use `\d schema.table` instead.

---

## Discover Container Name (if uncertain)
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker ps --format \"{{.Names}}\" | grep -i ndt'"
```

## Discover DB Credentials (if uncertain)
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 env | grep -E \"POSTGRES|USER\"'"
```
