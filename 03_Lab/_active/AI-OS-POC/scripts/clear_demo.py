#!/usr/bin/env python3
import os
import sys

try:
    import psycopg2
except ImportError:
    print("psycopg2 is not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://aios:aios@localhost:5432/aios")
TENANT_ID = "demo-tenant"


def connect():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        sys.exit(1)


def table_exists(cur, table_name):
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
        (table_name,),
    )
    return cur.fetchone()[0]


def delete_table(cur, table, by_tenant=True):
    if not table_exists(cur, table):
        print(f"  [SKIP]   {table} — table does not exist")
        return 0
    if by_tenant:
        cur.execute(f"DELETE FROM {table} WHERE tenant_id = %s", (TENANT_ID,))
    else:
        cur.execute(f"DELETE FROM {table} WHERE id IN (SELECT ili.id FROM {table} ili JOIN invoices i ON ili.invoice_id = i.id WHERE i.tenant_id = %s)", (TENANT_ID,))
    count = cur.rowcount
    print(f"  [DELETE] {table}: {count} row(s) removed")
    return count


def main():
    conn = connect()
    cur = conn.cursor()
    total = 0

    try:
        print(f"\nClearing demo data for tenant: {TENANT_ID}\n")

        total += delete_table(cur, "time_entries")

        if table_exists(cur, "invoice_line_items"):
            cur.execute(
                "DELETE FROM invoice_line_items WHERE invoice_id IN "
                "(SELECT id FROM invoices WHERE tenant_id = %s)",
                (TENANT_ID,),
            )
            count = cur.rowcount
            print(f"  [DELETE] invoice_line_items: {count} row(s) removed")
            total += count
        else:
            print("  [SKIP]   invoice_line_items — table does not exist")

        total += delete_table(cur, "invoices")

        if table_exists(cur, "task_comments"):
            cur.execute(
                "DELETE FROM task_comments WHERE task_id IN "
                "(SELECT id FROM tasks WHERE tenant_id = %s)",
                (TENANT_ID,),
            )
            count = cur.rowcount
            print(f"  [DELETE] task_comments: {count} row(s) removed")
            total += count
        else:
            print("  [SKIP]   task_comments — table does not exist")

        total += delete_table(cur, "tasks")
        total += delete_table(cur, "deals")
        total += delete_table(cur, "contacts")
        total += delete_table(cur, "projects")
        total += delete_table(cur, "clients")

        conn.commit()
        print(f"\nCleared {total} total row(s) for tenant {TENANT_ID}")
        return 0

    except Exception as e:
        conn.rollback()
        print(f"\nError during clear: {e}")
        return 1
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
