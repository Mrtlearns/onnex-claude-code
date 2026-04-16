#!/usr/bin/env python3
"""
Salesforce → PostgreSQL historical data sync.

Pulls Account, Opportunity, Quote, QuoteLineItem, and Product2 records
from Salesforce via SOQL and upserts them into the sf.* schema.

Writes a row to app.job_runs before and after each run for Admin → Jobs tracking.

Usage:
  python3 sf_sync.py --mode full
  python3 sf_sync.py --mode incremental [--since 2025-01-01]
  (incremental with no --since auto-detects last successful run from app.job_runs)

Credentials come from environment variables (set in docker-compose.yml):
  SF_CLIENT_ID, SF_CLIENT_SECRET, SF_INSTANCE_URL
  PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
"""
import argparse
import json
import os
import sys
import time
import traceback as tb_module
import urllib.request
import urllib.parse
import urllib.error

import psycopg2
import psycopg2.extras


# ─── Auth ────────────────────────────────────────────────────────────────────

def get_sf_token(instance_url: str, client_id: str, client_secret: str) -> str:
    body = urllib.parse.urlencode({
        'grant_type':    'client_credentials',
        'client_id':     client_id,
        'client_secret': client_secret,
    }).encode('utf-8')
    req = urllib.request.Request(
        f'{instance_url}/services/oauth2/token',
        data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return data['access_token']


# ─── SOQL pagination ─────────────────────────────────────────────────────────

def soql_query(instance_url: str, token: str, soql: str):
    """Yield all records from a paginated SOQL query."""
    encoded = urllib.parse.quote(soql)
    url = f'{instance_url}/services/data/v59.0/query?q={encoded}'
    while url:
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        for record in data.get('records', []):
            yield record
        next_url = data.get('nextRecordsUrl')
        url = f'{instance_url}{next_url}' if next_url else None


# ─── DB helpers ───────────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(
        host=os.environ.get('PGHOST', 'localhost'),
        port=int(os.environ.get('PGPORT', 5432)),
        dbname=os.environ.get('PGDATABASE', 'ndtportal'),
        user=os.environ.get('PGUSER', 'ndtapp'),
        password=os.environ.get('PGPASSWORD', ''),
    )


def split_multivalue(value: str | None) -> list[str] | None:
    """Split a Salesforce semicolon-delimited picklist into a list."""
    if not value:
        return None
    parts = [v.strip() for v in value.split(';') if v.strip()]
    return parts if parts else None


def parse_date(value: str | None) -> str | None:
    if not value:
        return None
    return value[:10]  # YYYY-MM-DD


# ─── job_runs helpers ─────────────────────────────────────────────────────────

def get_last_sync(cur) -> str | None:
    """Return the ISO date (YYYY-MM-DD) of the last successful sf_sync run, or None."""
    cur.execute("""
        SELECT finished_at::date
        FROM app.job_runs
        WHERE job_name = 'sf_sync' AND status = 'success'
        ORDER BY finished_at DESC
        LIMIT 1
    """)
    row = cur.fetchone()
    if row and row[0]:
        return str(row[0])
    return None


def job_start(cur, db) -> int:
    cur.execute(
        "INSERT INTO app.job_runs (job_name, started_at, status) VALUES ('sf_sync', now(), 'running') RETURNING id"
    )
    run_id = cur.fetchone()[0]
    db.commit()
    return run_id


def job_success(cur, db, run_id: int, start_ms: float, counts: dict, summary: str):
    elapsed_ms = int((time.time() - start_ms) * 1000)
    cur.execute(
        """UPDATE app.job_runs
           SET finished_at = now(), duration_ms = %s, status = 'success',
               records_upserted = %s, summary = %s
           WHERE id = %s""",
        (elapsed_ms, json.dumps(counts), summary, run_id),
    )
    db.commit()


def job_error(cur, db, run_id: int, traceback_str: str):
    cur.execute(
        """UPDATE app.job_runs
           SET finished_at = now(), status = 'error', error = %s
           WHERE id = %s""",
        (traceback_str, run_id),
    )
    db.commit()


# ─── Sync: Accounts ──────────────────────────────────────────────────────────

ACCOUNTS_SOQL_BASE = """
SELECT Id, Name, Type, Primary_Market__c, Account_Status__c,
       Primary_Approvals__c, Rate_Sheet_on_File__c, Payment_Terms__c,
       YTD_Account_Toal__c,
       BillingState, BillingCountry, BillingCity,
       Owner.Name, CreatedDate, Phone,
       Techniques_Criterias__c, WO_Notes__c, Add_WO_Notes__c, Add_WO_Notes_2__c,
       Region__c, Type_Of_Client__c, FAA_Account__c, Top_10_Account__c,
       Credit_Hold__c, Courier__c, Courier_Acct__c, Delivery_Method_s__c,
       YTD_Lab_Revenue__c, YTD_Field_Revenue__c,
       Lab_Pricing_Direction__c, Admin_Fee__c, Competitors_Used__c
FROM Account
""".strip()


def sync_accounts(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = ACCOUNTS_SOQL_BASE
    if since:
        soql += f" WHERE SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        owner = rec.get('Owner')
        owner_name = owner.get('Name') if isinstance(owner, dict) else None

        cur.execute(
            """
            INSERT INTO sf.accounts
              (sf_id, name, type, market, status, oem_approvals,
               rate_sheet_ver, payment_terms, ytd_total,
               billing_state, billing_country, billing_city,
               owner_name, created_date, phone,
               techniques_criterias, wo_notes, add_wo_notes, add_wo_notes_2,
               region, client_types, faa_account, top_10_account, credit_hold,
               courier, courier_acct, delivery_methods,
               ytd_lab_revenue, ytd_field_revenue,
               lab_pricing_direction, admin_fee_pct, competitors,
               synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              name                  = EXCLUDED.name,
              type                  = EXCLUDED.type,
              market                = EXCLUDED.market,
              status                = EXCLUDED.status,
              oem_approvals         = EXCLUDED.oem_approvals,
              rate_sheet_ver        = EXCLUDED.rate_sheet_ver,
              payment_terms         = EXCLUDED.payment_terms,
              ytd_total             = EXCLUDED.ytd_total,
              billing_state         = EXCLUDED.billing_state,
              billing_country       = EXCLUDED.billing_country,
              billing_city          = EXCLUDED.billing_city,
              owner_name            = EXCLUDED.owner_name,
              created_date          = EXCLUDED.created_date,
              phone                 = EXCLUDED.phone,
              techniques_criterias  = EXCLUDED.techniques_criterias,
              wo_notes              = EXCLUDED.wo_notes,
              add_wo_notes          = EXCLUDED.add_wo_notes,
              add_wo_notes_2        = EXCLUDED.add_wo_notes_2,
              region                = EXCLUDED.region,
              client_types          = EXCLUDED.client_types,
              faa_account           = EXCLUDED.faa_account,
              top_10_account        = EXCLUDED.top_10_account,
              credit_hold           = EXCLUDED.credit_hold,
              courier               = EXCLUDED.courier,
              courier_acct          = EXCLUDED.courier_acct,
              delivery_methods      = EXCLUDED.delivery_methods,
              ytd_lab_revenue       = EXCLUDED.ytd_lab_revenue,
              ytd_field_revenue     = EXCLUDED.ytd_field_revenue,
              lab_pricing_direction = EXCLUDED.lab_pricing_direction,
              admin_fee_pct         = EXCLUDED.admin_fee_pct,
              competitors           = EXCLUDED.competitors,
              synced_at             = now()
            """,
            (
                rec['Id'],
                rec.get('Name'),
                rec.get('Type'),
                rec.get('Primary_Market__c'),
                rec.get('Account_Status__c'),
                split_multivalue(rec.get('Primary_Approvals__c')),
                rec.get('Rate_Sheet_on_File__c'),
                rec.get('Payment_Terms__c'),
                rec.get('YTD_Account_Toal__c'),
                rec.get('BillingState'),
                rec.get('BillingCountry'),
                rec.get('BillingCity'),
                owner_name,
                parse_date(rec.get('CreatedDate')),
                rec.get('Phone'),
                rec.get('Techniques_Criterias__c'),
                rec.get('WO_Notes__c'),
                rec.get('Add_WO_Notes__c'),
                rec.get('Add_WO_Notes_2__c'),
                rec.get('Region__c'),
                split_multivalue(rec.get('Type_Of_Client__c')),
                rec.get('FAA_Account__c'),
                rec.get('Top_10_Account__c'),
                rec.get('Credit_Hold__c'),
                rec.get('Courier__c'),
                rec.get('Courier_Acct__c'),
                rec.get('Delivery_Method_s__c'),
                rec.get('YTD_Lab_Revenue__c'),
                rec.get('YTD_Field_Revenue__c'),
                rec.get('Lab_Pricing_Direction__c'),
                rec.get('Admin_Fee__c'),
                split_multivalue(rec.get('Competitors_Used__c')),
            ),
        )
        count += 1
    return count


# ─── Sync: Jobs (Opportunity) ────────────────────────────────────────────────

JOBS_SOQL_BASE = """
SELECT Id, AccountId, Account.Name, Project_Number__c, Invoice_No__c,
       Invoice_Amount__c, Part_No__c, Rev_No__c, Lot_Batch_Serial_No__c,
       Service__c, Specification__c, NDT_Procedure__c, Acceptance_Criteria__c,
       Scope__c, PO__c, Price_Per__c, Date_Received_Lab__c, Date_Completed_Lab__c,
       RecordType.Name, CloseDate,
       StageName, Amount, Owner.Name, CreatedDate, Description, IsWon, IsClosed,
       Lab_Status__c, Billing_Status__c, Date_Due_Lab__c, ContactId,
       No_Parts_Received__c, Lab_Notes__c, Billing_Notes__c,
       FAA__c, Expedite__c, Expedite_Type__c, Expedite_Fee__c,
       Inspection_time__c, Film_sq_in__c,
       Subtotal__c, Total__c, Admin_Fee__c, Pricing_Details__c
FROM Opportunity WHERE IsDeleted = false
""".strip()


def sync_jobs(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = JOBS_SOQL_BASE
    if since:
        soql += f" AND SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        acct_id = rec.get('AccountId')
        if not acct_id:
            continue

        services_raw = rec.get('Service__c')
        services = split_multivalue(services_raw)

        rt = rec.get('RecordType')
        record_type = rt.get('Name') if isinstance(rt, dict) else None

        job_owner = rec.get('Owner')
        owner_name = job_owner.get('Name') if isinstance(job_owner, dict) else None

        cur.execute(
            """
            INSERT INTO sf.jobs
              (sf_id, account_sf_id, account_name, work_order_number, invoice_number,
               invoice_amount, part_number, part_rev, lot_serial, services,
               specification, ndt_procedure, acceptance_criteria, scope,
               po_number, price_per_basis, date_received, date_completed,
               record_type, close_date,
               stage_name, amount, owner_name, created_date, description,
               is_won, is_closed,
               lab_status, billing_status, date_due, contact_sf_id,
               qty_received, lab_notes, billing_notes,
               faa_job, expedite, expedite_type, expedite_fee,
               inspection_time_min, film_sq_in,
               subtotal, total, admin_fee_amount, pricing_details,
               synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              account_sf_id       = EXCLUDED.account_sf_id,
              account_name        = EXCLUDED.account_name,
              work_order_number   = EXCLUDED.work_order_number,
              invoice_number      = EXCLUDED.invoice_number,
              invoice_amount      = EXCLUDED.invoice_amount,
              part_number         = EXCLUDED.part_number,
              part_rev            = EXCLUDED.part_rev,
              lot_serial          = EXCLUDED.lot_serial,
              services            = EXCLUDED.services,
              specification       = EXCLUDED.specification,
              ndt_procedure       = EXCLUDED.ndt_procedure,
              acceptance_criteria = EXCLUDED.acceptance_criteria,
              scope               = EXCLUDED.scope,
              po_number           = EXCLUDED.po_number,
              price_per_basis     = EXCLUDED.price_per_basis,
              date_received       = EXCLUDED.date_received,
              date_completed      = EXCLUDED.date_completed,
              record_type         = EXCLUDED.record_type,
              close_date          = EXCLUDED.close_date,
              stage_name          = EXCLUDED.stage_name,
              amount              = EXCLUDED.amount,
              owner_name          = EXCLUDED.owner_name,
              created_date        = EXCLUDED.created_date,
              description         = EXCLUDED.description,
              is_won              = EXCLUDED.is_won,
              is_closed           = EXCLUDED.is_closed,
              lab_status          = EXCLUDED.lab_status,
              billing_status      = EXCLUDED.billing_status,
              date_due            = EXCLUDED.date_due,
              contact_sf_id       = EXCLUDED.contact_sf_id,
              qty_received        = EXCLUDED.qty_received,
              lab_notes           = EXCLUDED.lab_notes,
              billing_notes       = EXCLUDED.billing_notes,
              faa_job             = EXCLUDED.faa_job,
              expedite            = EXCLUDED.expedite,
              expedite_type       = EXCLUDED.expedite_type,
              expedite_fee        = EXCLUDED.expedite_fee,
              inspection_time_min = EXCLUDED.inspection_time_min,
              film_sq_in          = EXCLUDED.film_sq_in,
              subtotal            = EXCLUDED.subtotal,
              total               = EXCLUDED.total,
              admin_fee_amount    = EXCLUDED.admin_fee_amount,
              pricing_details     = EXCLUDED.pricing_details,
              synced_at           = now()
            """,
            (
                rec['Id'],
                acct_id,
                rec.get('Account', {}).get('Name') if isinstance(rec.get('Account'), dict) else None,
                rec.get('Project_Number__c'),
                rec.get('Invoice_No__c'),
                rec.get('Invoice_Amount__c'),
                rec.get('Part_No__c'),
                rec.get('Rev_No__c'),
                rec.get('Lot_Batch_Serial_No__c'),
                services,
                rec.get('Specification__c'),
                rec.get('NDT_Procedure__c'),
                rec.get('Acceptance_Criteria__c'),
                rec.get('Scope__c'),
                rec.get('PO__c'),
                rec.get('Price_Per__c'),
                parse_date(rec.get('Date_Received_Lab__c')),
                parse_date(rec.get('Date_Completed_Lab__c')),
                record_type,
                parse_date(rec.get('CloseDate')),
                rec.get('StageName'),
                rec.get('Amount'),
                owner_name,
                parse_date(rec.get('CreatedDate')),
                rec.get('Description'),
                rec.get('IsWon'),
                rec.get('IsClosed'),
                rec.get('Lab_Status__c'),
                rec.get('Billing_Status__c'),
                parse_date(rec.get('Date_Due_Lab__c')),
                rec.get('ContactId'),
                rec.get('No_Parts_Received__c'),
                rec.get('Lab_Notes__c'),
                rec.get('Billing_Notes__c'),
                rec.get('FAA__c'),
                rec.get('Expedite__c'),
                rec.get('Expedite_Type__c'),
                rec.get('Expedite_Fee__c'),
                rec.get('Inspection_time__c'),
                rec.get('Film_sq_in__c'),
                rec.get('Subtotal__c'),
                rec.get('Total__c'),
                rec.get('Admin_Fee__c'),
                rec.get('Pricing_Details__c'),
            ),
        )
        count += 1
    return count


# ─── Sync: Quotes ─────────────────────────────────────────────────────────────

QUOTES_SOQL_BASE = """
SELECT Id, OpportunityId, AccountId, QuoteNumber, Part_Number__c, Includes__c,
       GrandTotal, Status, ExpirationDate, Per__c, Notes__c, Description, CreatedDate
FROM Quote
""".strip()


def sync_quotes(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = QUOTES_SOQL_BASE
    if since:
        soql += f" WHERE SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        job_id = rec.get('OpportunityId')
        acct_id = rec.get('AccountId')

        services_raw = rec.get('Includes__c')
        services = split_multivalue(services_raw)

        cur.execute(
            """
            INSERT INTO sf.quotes
              (sf_id, job_sf_id, account_sf_id, quote_number, part_numbers,
               services_included, grand_total, status, expiration_date,
               pricing_basis, notes, description, created_date, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              job_sf_id         = EXCLUDED.job_sf_id,
              account_sf_id     = EXCLUDED.account_sf_id,
              quote_number      = EXCLUDED.quote_number,
              part_numbers      = EXCLUDED.part_numbers,
              services_included = EXCLUDED.services_included,
              grand_total       = EXCLUDED.grand_total,
              status            = EXCLUDED.status,
              expiration_date   = EXCLUDED.expiration_date,
              pricing_basis     = EXCLUDED.pricing_basis,
              notes             = EXCLUDED.notes,
              description       = EXCLUDED.description,
              created_date      = EXCLUDED.created_date,
              synced_at         = now()
            """,
            (
                rec['Id'],
                job_id,
                acct_id,
                rec.get('QuoteNumber'),
                rec.get('Part_Number__c'),
                services,
                rec.get('GrandTotal'),
                rec.get('Status'),
                parse_date(rec.get('ExpirationDate')),
                rec.get('Per__c'),
                rec.get('Notes__c'),
                rec.get('Description'),
                parse_date(rec.get('CreatedDate')),
            ),
        )
        count += 1
    return count


# ─── Sync: Quote Line Items ────────────────────────────────────────────────────

QUOTE_LINES_SOQL_BASE = """
SELECT Id, QuoteId, Product2.ProductCode, Product2.Name, Product2.Family,
       Quantity, UnitPrice, ListPrice, TotalPrice, Description__c, LineNumber
FROM QuoteLineItem
""".strip()


def sync_quote_lines(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = QUOTE_LINES_SOQL_BASE
    if since:
        soql += f" WHERE SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        p2 = rec.get('Product2') or {}

        cur.execute(
            """
            INSERT INTO sf.quote_lines
              (sf_id, quote_sf_id, product_code, product_name, quantity,
               unit_price, total_price, list_price, description, line_number, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              quote_sf_id  = EXCLUDED.quote_sf_id,
              product_code = EXCLUDED.product_code,
              product_name = EXCLUDED.product_name,
              quantity     = EXCLUDED.quantity,
              unit_price   = EXCLUDED.unit_price,
              total_price  = EXCLUDED.total_price,
              list_price   = EXCLUDED.list_price,
              description  = EXCLUDED.description,
              line_number  = EXCLUDED.line_number,
              synced_at    = now()
            """,
            (
                rec['Id'],
                rec.get('QuoteId'),
                p2.get('ProductCode'),
                p2.get('Name'),
                rec.get('Quantity'),
                rec.get('UnitPrice'),
                rec.get('TotalPrice'),
                rec.get('ListPrice'),
                rec.get('Description__c'),
                rec.get('LineNumber'),
            ),
        )
        count += 1
    return count


# ─── Sync: Products ──────────────────────────────────────────────────────────

PRODUCTS_SOQL = """
SELECT Id, ProductCode, Name, Family, Description, IsActive FROM Product2
""".strip()


# ─── Sync: Contacts ───────────────────────────────────────────────────────────

CONTACTS_SOQL_BASE = """
SELECT Id, AccountId, Account.Name, FirstName, LastName, Email, Phone,
       Title, Department
FROM Contact WHERE IsDeleted = false
""".strip()


def sync_contacts(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = CONTACTS_SOQL_BASE
    if since:
        soql += f" AND SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        acct_id = rec.get('AccountId')
        acct = rec.get('Account')
        acct_name = acct.get('Name') if isinstance(acct, dict) else None

        cur.execute(
            """
            INSERT INTO sf.contacts
              (sf_id, account_sf_id, account_name, first_name, last_name,
               email, phone, title, department, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              account_sf_id = EXCLUDED.account_sf_id,
              account_name  = EXCLUDED.account_name,
              first_name    = EXCLUDED.first_name,
              last_name     = EXCLUDED.last_name,
              email         = EXCLUDED.email,
              phone         = EXCLUDED.phone,
              title         = EXCLUDED.title,
              department    = EXCLUDED.department,
              synced_at     = now()
            """,
            (
                rec['Id'],
                acct_id,
                acct_name,
                rec.get('FirstName'),
                rec.get('LastName', ''),
                rec.get('Email'),
                rec.get('Phone'),
                rec.get('Title'),
                rec.get('Department'),
            ),
        )
        count += 1
    return count


# ─── Sync: Contracts ──────────────────────────────────────────────────────────

CONTRACTS_SOQL_BASE = """
SELECT Id, AccountId, ContractNumber, Status, StartDate, EndDate,
       Description, Owner.Name
FROM Contract
""".strip()


def sync_contracts(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = CONTRACTS_SOQL_BASE
    if since:
        soql += f" WHERE SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        owner = rec.get('Owner')
        owner_name = owner.get('Name') if isinstance(owner, dict) else None

        cur.execute(
            """
            INSERT INTO sf.contracts
              (sf_id, account_sf_id, contract_number, status, start_date,
               end_date, description, owner_name, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              account_sf_id   = EXCLUDED.account_sf_id,
              contract_number = EXCLUDED.contract_number,
              status          = EXCLUDED.status,
              start_date      = EXCLUDED.start_date,
              end_date        = EXCLUDED.end_date,
              description     = EXCLUDED.description,
              owner_name      = EXCLUDED.owner_name,
              synced_at       = now()
            """,
            (
                rec['Id'],
                rec.get('AccountId'),
                rec.get('ContractNumber'),
                rec.get('Status'),
                parse_date(rec.get('StartDate')),
                parse_date(rec.get('EndDate')),
                rec.get('Description'),
                owner_name,
            ),
        )
        count += 1
    return count


# ─── Sync: Pricebook Entries ──────────────────────────────────────────────────

PRICEBOOK_ENTRIES_SOQL = """
SELECT Id, Product2Id, Product2.ProductCode, Product2.Name,
       Pricebook2.Name, UnitPrice, IsActive
FROM PricebookEntry WHERE IsActive = true
""".strip()


def sync_pricebook_entries(cur, instance_url: str, token: str) -> int:
    count = 0
    for rec in soql_query(instance_url, token, PRICEBOOK_ENTRIES_SOQL):
        p2 = rec.get('Product2') or {}
        pb = rec.get('Pricebook2') or {}

        cur.execute(
            """
            INSERT INTO sf.pricebook_entries
              (sf_id, product_sf_id, product_code, product_name,
               pricebook_name, unit_price, is_active, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              product_sf_id  = EXCLUDED.product_sf_id,
              product_code   = EXCLUDED.product_code,
              product_name   = EXCLUDED.product_name,
              pricebook_name = EXCLUDED.pricebook_name,
              unit_price     = EXCLUDED.unit_price,
              is_active      = EXCLUDED.is_active,
              synced_at      = now()
            """,
            (
                rec['Id'],
                rec.get('Product2Id'),
                p2.get('ProductCode'),
                p2.get('Name'),
                pb.get('Name'),
                rec.get('UnitPrice'),
                rec.get('IsActive', True),
            ),
        )
        count += 1
    return count


# ─── Sync: Orders ─────────────────────────────────────────────────────────────

ORDERS_SOQL_BASE = """
SELECT Id, AccountId, OrderNumber, Status, EffectiveDate,
       TotalAmount, Pricebook2Id, Description, Owner.Name
FROM Order WHERE IsDeleted = false
""".strip()


def sync_orders(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = ORDERS_SOQL_BASE
    if since:
        soql += f" AND SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        # OpportunityId may be null if Order was not created from an Opportunity
        opp_id = rec.get('OpportunityId')
        owner = rec.get('Owner')
        owner_name = owner.get('Name') if isinstance(owner, dict) else None

        cur.execute(
            """
            INSERT INTO sf.orders
              (sf_id, account_sf_id, order_number, status,
               order_start_date, total_amount, description, owner_name, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              account_sf_id    = EXCLUDED.account_sf_id,
              order_number     = EXCLUDED.order_number,
              status           = EXCLUDED.status,
              order_start_date = EXCLUDED.order_start_date,
              total_amount     = EXCLUDED.total_amount,
              description      = EXCLUDED.description,
              owner_name       = EXCLUDED.owner_name,
              synced_at        = now()
            """,
            (
                rec['Id'],
                rec.get('AccountId'),
                rec.get('OrderNumber'),
                rec.get('Status'),
                parse_date(rec.get('EffectiveDate')),
                rec.get('TotalAmount'),
                rec.get('Description'),
                owner_name,
            ),
        )
        count += 1
    return count


# ─── Sync: Order Items ────────────────────────────────────────────────────────

ORDER_ITEMS_SOQL_BASE = """
SELECT Id, OrderId, Product2Id, Product2.ProductCode, Product2.Name,
       Quantity, UnitPrice, TotalPrice, Description
FROM OrderItem
""".strip()


def sync_order_items(cur, instance_url: str, token: str, since: str | None) -> int:
    soql = ORDER_ITEMS_SOQL_BASE
    if since:
        soql += f" WHERE SystemModstamp >= {since}T00:00:00Z"

    count = 0
    for rec in soql_query(instance_url, token, soql):
        p2 = rec.get('Product2') or {}

        cur.execute(
            """
            INSERT INTO sf.order_items
              (sf_id, order_sf_id, product_sf_id, product_code, product_name,
               quantity, unit_price, total_price, description, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              order_sf_id  = EXCLUDED.order_sf_id,
              product_sf_id= EXCLUDED.product_sf_id,
              product_code = EXCLUDED.product_code,
              product_name = EXCLUDED.product_name,
              quantity     = EXCLUDED.quantity,
              unit_price   = EXCLUDED.unit_price,
              total_price  = EXCLUDED.total_price,
              description  = EXCLUDED.description,
              synced_at    = now()
            """,
            (
                rec['Id'],
                rec.get('OrderId'),
                rec.get('Product2Id'),
                p2.get('ProductCode'),
                p2.get('Name'),
                rec.get('Quantity'),
                rec.get('UnitPrice'),
                rec.get('TotalPrice'),
                rec.get('Description'),
            ),
        )
        count += 1
    return count


# ─── Sync: BOM Items (custom object — confirm API name via sf_discover.py) ────
# BOM_OBJECT_API_NAME must be set in the environment once the custom object name
# is confirmed. If unset, this sync step is silently skipped.
# Set via docker-compose.yml: SF_BOM_OBJECT=BOM__c (or whatever the API name is)

BOM_ITEMS_SOQL_TEMPLATE = """
SELECT Id, {account_field}, {part_number_field}, {rev_field},
       {service_field}, {spec_field}, {technique_field},
       {procedure_field}, {acceptance_criteria_field},
       {drawing_field}, {notes_field}, {active_field}, {effective_date_field}
FROM {object_name} WHERE IsDeleted = false
""".strip()

# Default field name guesses — override via env vars after sf_discover.py confirms names
BOM_FIELD_MAP = {
    'object_name':              os.environ.get('SF_BOM_OBJECT', ''),
    'account_field':            os.environ.get('SF_BOM_ACCOUNT_FIELD',     'AccountId'),
    'part_number_field':        os.environ.get('SF_BOM_PART_FIELD',        'Part_No__c'),
    'rev_field':                os.environ.get('SF_BOM_REV_FIELD',         'Rev__c'),
    'service_field':            os.environ.get('SF_BOM_SERVICE_FIELD',     'Service__c'),
    'spec_field':               os.environ.get('SF_BOM_SPEC_FIELD',        'Specification__c'),
    'technique_field':          os.environ.get('SF_BOM_TECHNIQUE_FIELD',   'Technique__c'),
    'procedure_field':          os.environ.get('SF_BOM_PROCEDURE_FIELD',   'NDT_Procedure__c'),
    'acceptance_criteria_field':os.environ.get('SF_BOM_AC_FIELD',          'Acceptance_Criteria__c'),
    'drawing_field':            os.environ.get('SF_BOM_DRAWING_FIELD',     'Drawing_No__c'),
    'notes_field':              os.environ.get('SF_BOM_NOTES_FIELD',       'Notes__c'),
    'active_field':             os.environ.get('SF_BOM_ACTIVE_FIELD',      'IsActive'),
    'effective_date_field':     os.environ.get('SF_BOM_DATE_FIELD',        'Effective_Date__c'),
}


def sync_bom_items(cur, instance_url: str, token: str, since: str | None) -> int:
    """Sync BOM custom object. Skipped if SF_BOM_OBJECT env var is not set."""
    obj_name = BOM_FIELD_MAP['object_name']
    if not obj_name:
        print('[sf-sync]   bom_items: SKIPPED (SF_BOM_OBJECT not set — run sf_discover.py first)')
        return 0

    soql = BOM_ITEMS_SOQL_TEMPLATE.format(**BOM_FIELD_MAP)
    if since:
        soql += f" AND SystemModstamp >= {since}T00:00:00Z"

    fm = BOM_FIELD_MAP
    count = 0
    for rec in soql_query(instance_url, token, soql):
        cur.execute(
            """
            INSERT INTO sf.bom_items
              (sf_id, account_sf_id, part_number, part_rev,
               service, specification, technique, ndt_procedure,
               acceptance_criteria, drawing_number, notes,
               is_active, effective_date, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              account_sf_id       = EXCLUDED.account_sf_id,
              part_number         = EXCLUDED.part_number,
              part_rev            = EXCLUDED.part_rev,
              service             = EXCLUDED.service,
              specification       = EXCLUDED.specification,
              technique           = EXCLUDED.technique,
              ndt_procedure       = EXCLUDED.ndt_procedure,
              acceptance_criteria = EXCLUDED.acceptance_criteria,
              drawing_number      = EXCLUDED.drawing_number,
              notes               = EXCLUDED.notes,
              is_active           = EXCLUDED.is_active,
              effective_date      = EXCLUDED.effective_date,
              synced_at           = now()
            """,
            (
                rec['Id'],
                rec.get(fm['account_field']),
                rec.get(fm['part_number_field']),
                rec.get(fm['rev_field']),
                rec.get(fm['service_field']),
                rec.get(fm['spec_field']),
                rec.get(fm['technique_field']),
                rec.get(fm['procedure_field']),
                rec.get(fm['acceptance_criteria_field']),
                rec.get(fm['drawing_field']),
                rec.get(fm['notes_field']),
                rec.get(fm['active_field'], True),
                parse_date(rec.get(fm['effective_date_field'])),
            ),
        )
        count += 1
    return count


def sync_products(cur, instance_url: str, token: str) -> int:
    count = 0
    for rec in soql_query(instance_url, token, PRODUCTS_SOQL):
        cur.execute(
            """
            INSERT INTO sf.products
              (sf_id, product_code, name, family, description, is_active, synced_at)
            VALUES (%s,%s,%s,%s,%s,%s,now())
            ON CONFLICT (sf_id) DO UPDATE SET
              product_code = EXCLUDED.product_code,
              name         = EXCLUDED.name,
              family       = EXCLUDED.family,
              description  = EXCLUDED.description,
              is_active    = EXCLUDED.is_active,
              synced_at    = now()
            """,
            (
                rec['Id'],
                rec.get('ProductCode'),
                rec.get('Name'),
                rec.get('Family'),
                rec.get('Description'),
                rec.get('IsActive', True),
            ),
        )
        count += 1
    return count


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Sync Salesforce data to PostgreSQL')
    parser.add_argument('--mode', choices=['full', 'incremental'], default='full')
    parser.add_argument('--since', default=None,
                        help='ISO date (YYYY-MM-DD) for incremental mode. '
                             'Omit to auto-detect from last successful job_run.')
    args = parser.parse_args()

    instance_url  = os.environ.get('SF_INSTANCE_URL', '').rstrip('/')
    client_id     = os.environ.get('SF_CLIENT_ID', '')
    client_secret = os.environ.get('SF_CLIENT_SECRET', '')

    if not all([instance_url, client_id, client_secret]):
        print('ERROR: SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET must be set')
        sys.exit(1)

    db  = get_db()
    cur = db.cursor()
    psycopg2.extras.register_default_jsonb(cur)

    # ── Determine since date ─────────────────────────────────────────────────
    since: str | None = None
    if args.mode == 'incremental':
        since = args.since or get_last_sync(cur)

    print(f'[sf-sync] mode={args.mode} since={since or "N/A (full)"}')

    # ── Register job start ───────────────────────────────────────────────────
    run_id = job_start(cur, db)
    start_ms = time.time()
    print(f'[sf-sync] job_run id={run_id} registered')

    print('[sf-sync] Obtaining Salesforce access token...')
    token = get_sf_token(instance_url, client_id, client_secret)
    print('[sf-sync] Token obtained')

    try:
        print('[sf-sync] Syncing accounts...')
        n_accounts = sync_accounts(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   accounts: {n_accounts}')

        print('[sf-sync] Syncing jobs (Opportunity)...')
        n_jobs = sync_jobs(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   jobs: {n_jobs}')

        print('[sf-sync] Syncing quotes...')
        n_quotes = sync_quotes(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   quotes: {n_quotes}')

        print('[sf-sync] Syncing quote line items...')
        n_lines = sync_quote_lines(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   quote_lines: {n_lines}')

        print('[sf-sync] Syncing products...')
        n_products = sync_products(cur, instance_url, token)
        db.commit()
        print(f'[sf-sync]   products: {n_products}')

        print('[sf-sync] Syncing pricebook entries...')
        n_pbe = sync_pricebook_entries(cur, instance_url, token)
        db.commit()
        print(f'[sf-sync]   pricebook_entries: {n_pbe}')

        print('[sf-sync] Syncing contacts...')
        n_contacts = sync_contacts(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   contacts: {n_contacts}')

        print('[sf-sync] Syncing contracts...')
        n_contracts = sync_contracts(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   contracts: {n_contracts}')

        print('[sf-sync] Syncing orders...')
        n_orders = sync_orders(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   orders: {n_orders}')

        print('[sf-sync] Syncing order items...')
        n_order_items = sync_order_items(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   order_items: {n_order_items}')

        print('[sf-sync] Syncing BOM items (custom object)...')
        n_bom_items = sync_bom_items(cur, instance_url, token, since)
        db.commit()
        print(f'[sf-sync]   bom_items: {n_bom_items}')

        print('[sf-sync] Refreshing BOM materialized view...')
        cur.execute('REFRESH MATERIALIZED VIEW sf.bom_parts')
        db.commit()

        cur.execute('SELECT count(*) FROM sf.bom_parts')
        n_bom = cur.fetchone()[0]
        print(f'[sf-sync]   bom_parts: {n_bom}')

        summary = (
            f'accounts: {n_accounts}, jobs: {n_jobs}, quotes: {n_quotes}, '
            f'quote_lines: {n_lines}, products: {n_products}, '
            f'pricebook_entries: {n_pbe}, contacts: {n_contacts}, '
            f'contracts: {n_contracts}, orders: {n_orders}, '
            f'order_items: {n_order_items}, bom_items: {n_bom_items}, '
            f'bom_parts: {n_bom}'
        )
        counts = {
            'accounts':         n_accounts,
            'jobs':             n_jobs,
            'quotes':           n_quotes,
            'quote_lines':      n_lines,
            'products':         n_products,
            'pricebook_entries':n_pbe,
            'contacts':         n_contacts,
            'contracts':        n_contracts,
            'orders':           n_orders,
            'order_items':      n_order_items,
            'bom_items':        n_bom_items,
            'bom_parts':        n_bom,
        }

        job_success(cur, db, run_id, start_ms, counts, summary)

        elapsed = time.time() - start_ms
        print(f'\n[sf-sync] COMPLETE in {elapsed:.1f}s — {summary}')

    except Exception as exc:
        db.rollback()
        traceback_str = tb_module.format_exc()
        print(f'[sf-sync] ERROR: {exc}', file=sys.stderr)
        try:
            job_error(cur, db, run_id, traceback_str)
        except Exception:
            pass
        raise
    finally:
        cur.close()
        db.close()


if __name__ == '__main__':
    main()
