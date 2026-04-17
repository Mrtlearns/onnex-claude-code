#!/usr/bin/env python3
import os
import sys
import uuid
from datetime import datetime, timedelta

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("psycopg2 is not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://aios:aios@localhost:5432/aios")
TENANT_ID = "demo-tenant"
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

now = datetime.utcnow()


def connect():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        sys.exit(1)


def insert_one(cur, table, row, conflict_col="id"):
    cols = list(row.keys())
    placeholders = [f"%({c})s" for c in cols]
    sql = (
        f"INSERT INTO {table} ({', '.join(cols)}) "
        f"VALUES ({', '.join(placeholders)}) "
        f"ON CONFLICT ({conflict_col}) DO NOTHING"
    )
    cur.execute(sql, row)
    inserted = cur.rowcount
    if inserted:
        print(f"  [INSERT] {table}: {row.get('name') or row.get('title') or row.get('description') or row.get('invoice_number') or row['id']}")
    else:
        print(f"  [SKIP]   {table}: {row.get('name') or row.get('title') or row.get('description') or row.get('invoice_number') or row['id']} (already exists)")
    return inserted


def main():
    conn = connect()
    cur = conn.cursor()
    total = 0

    try:
        apex_id = str(uuid.uuid4())
        bluestar_id = str(uuid.uuid4())
        cornerstone_id = str(uuid.uuid4())

        clients = [
            {"id": apex_id, "tenant_id": TENANT_ID, "name": "Apex Innovations",
             "email": "apex@example.com", "phone": "+1-555-0101", "status": "active", "created_at": now},
            {"id": bluestar_id, "tenant_id": TENANT_ID, "name": "BlueStar Media",
             "email": "bluestar@example.com", "phone": "+1-555-0102", "status": "active", "created_at": now},
            {"id": cornerstone_id, "tenant_id": TENANT_ID, "name": "Cornerstone Legal",
             "email": "cornerstone@example.com", "phone": "+1-555-0103", "status": "active", "created_at": now},
        ]

        print("\n--- Clients ---")
        for c in clients:
            total += insert_one(cur, "clients", c)

        contacts = [
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": apex_id,
             "name": "Alex Chen", "email": "alex.chen@example.com", "role": "Primary Contact", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": bluestar_id,
             "name": "Maria Santos", "email": "maria.santos@example.com", "role": "Primary Contact", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": cornerstone_id,
             "name": "James Wright", "email": "james.wright@example.com", "role": "Primary Contact", "created_at": now},
        ]

        print("\n--- Contacts ---")
        for c in contacts:
            total += insert_one(cur, "contacts", c)

        apex_project_id = str(uuid.uuid4())
        bluestar_project_id = str(uuid.uuid4())

        projects = [
            {"id": apex_project_id, "tenant_id": TENANT_ID, "client_id": apex_id,
             "name": "Apex Website Redesign", "status": "active", "budget": 25000, "created_at": now},
            {"id": bluestar_project_id, "tenant_id": TENANT_ID, "client_id": bluestar_id,
             "name": "BlueStar Brand Campaign", "status": "active", "budget": 18000, "created_at": now},
        ]

        print("\n--- Projects ---")
        for p in projects:
            total += insert_one(cur, "projects", p)

        tasks = [
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": apex_project_id,
             "title": "Wireframe home page", "status": "In Progress", "priority": "high", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": apex_project_id,
             "title": "Design review pass", "status": "Review", "priority": "medium", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": bluestar_project_id,
             "title": "Brand mood board", "status": "Backlog", "priority": "medium", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": bluestar_project_id,
             "title": "Logo variants delivery", "status": "Done", "priority": "high", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": None,
             "title": "Onboarding checklist update", "status": "Backlog", "priority": "low", "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": None,
             "title": "Quarterly report review", "status": "Done", "priority": "medium", "created_at": now},
        ]

        print("\n--- Tasks ---")
        for t in tasks:
            total += insert_one(cur, "tasks", t)

        deals = [
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": apex_id,
             "title": "Enterprise SaaS Package", "status": "negotiation", "value": 85000,
             "probability": 70, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": bluestar_id,
             "title": "Branding Retainer", "status": "proposal", "value": 36000,
             "probability": 50, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": cornerstone_id,
             "title": "SEO Campaign", "status": "won", "value": 12000,
             "probability": 100, "created_at": now},
        ]

        print("\n--- Deals ---")
        for d in deals:
            total += insert_one(cur, "deals", d)

        issued_30_ago = now - timedelta(days=30)
        due_15_ago = now - timedelta(days=15)
        issued_7_ago = now - timedelta(days=7)
        due_23_ahead = now + timedelta(days=23)

        invoices = [
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": apex_id,
             "invoice_number": "INV-DEMO-001", "status": "paid", "total_amount": 12500,
             "issued_at": issued_30_ago, "due_at": due_15_ago, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "client_id": bluestar_id,
             "invoice_number": "INV-DEMO-002", "status": "sent", "total_amount": 8750,
             "issued_at": issued_7_ago, "due_at": due_23_ahead, "created_at": now},
        ]

        print("\n--- Invoices ---")
        for inv in invoices:
            total += insert_one(cur, "invoices", inv, conflict_col="invoice_number")

        time_entries = [
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": apex_project_id,
             "user_id": DEMO_USER_ID, "description": "Initial discovery session",
             "duration_minutes": 120, "date": (now - timedelta(days=5)).date(),
             "billable": True, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": apex_project_id,
             "user_id": DEMO_USER_ID, "description": "Wireframe build",
             "duration_minutes": 240, "date": (now - timedelta(days=3)).date(),
             "billable": True, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": apex_project_id,
             "user_id": DEMO_USER_ID, "description": "Client feedback call",
             "duration_minutes": 90, "date": (now - timedelta(days=1)).date(),
             "billable": True, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": bluestar_project_id,
             "user_id": DEMO_USER_ID, "description": "Brand strategy workshop",
             "duration_minutes": 480, "date": (now - timedelta(days=4)).date(),
             "billable": True, "created_at": now},
            {"id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": bluestar_project_id,
             "user_id": DEMO_USER_ID, "description": "Internal planning sync",
             "duration_minutes": 60, "date": (now - timedelta(days=2)).date(),
             "billable": False, "created_at": now},
        ]

        print("\n--- Time Entries ---")
        for te in time_entries:
            total += insert_one(cur, "time_entries", te)

        conn.commit()
        print(f"\nSeeded {total} records for tenant {TENANT_ID}")
        return 0

    except Exception as e:
        conn.rollback()
        print(f"\nError during seeding: {e}")
        return 1
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
