#!/usr/bin/env python3
"""Generate fresh demo data for PI Lawyer OS via API."""

import json, sys, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

BASE = 'http://localhost/api'
AUTH_BASE = 'http://localhost/auth'
HOST = '10.10.110.33'
EMAIL = 'admin@demo.pilaweros.local'
PASSWORD = 'Adm1n2026!'


def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def api(method, path, body=None, token=None, base=BASE):
    url = base + path
    data = json.dumps(body).encode() if body else None
    headers = {
        'Content-Type': 'application/json',
        'Host': HOST,
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if method == 'POST':
        headers['Prefer'] = 'return=representation'

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode()
            if not text:
                return {}
            d = json.loads(text)
            return d[0] if isinstance(d, list) and d else d
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        print(f'  HTTP {e.code} {method} {path}: {body_text[:200]}')
        return {}


def delete(path, token):
    url = BASE + path
    headers = {'Host': HOST, 'Authorization': f'Bearer {token}'}
    req = urllib.request.Request(url, headers=headers, method='DELETE')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


# ── Login ──────────────────────────────────────────────────────────────────────
print('Logging in...')
resp = api('POST', '/login', {'email': EMAIL, 'password': PASSWORD}, base=AUTH_BASE)
token = resp['token']
firm_id = resp['user']['firm_id']
print(f'  firm_id: {firm_id}')

# ── Clear ─────────────────────────────────────────────────────────────────────
print('Clearing existing data...')
tables = [
    'client_users', 'case_settlements', 'settlement_offers', 'case_costs',
    'tasks', 'communications', 'medical_providers', 'documents',
    'partner_referrals', 'cases', 'clients', 'partners', 'leads',
]
for t in tables:
    code = delete(f'/{t}?firm_id=eq.{firm_id}', token)
    print(f'  DELETE {t}: {code}')

# ── Partners ──────────────────────────────────────────────────────────────────
print('Creating partners...')
p_johnson = api('POST', '/partners', {'firm_id': firm_id, 'name': 'Johnson Legal Group', 'partner_type': 'attorney', 'phone': '702-555-0101', 'email': 'referrals@johnsonlegal.demo', 'active': True}, token)
p_spine = api('POST', '/partners', {'firm_id': firm_id, 'name': 'Vegas Spine & Chiro', 'partner_type': 'chiropractor', 'phone': '702-555-0202', 'email': 'intake@vegasspine.demo', 'active': True}, token)
p_kim = api('POST', '/partners', {'firm_id': firm_id, 'name': 'Dr. Rachel Kim MD', 'partner_type': 'medical', 'phone': '702-555-0303', 'email': 'records@rachelkim.demo', 'active': True}, token)
print(f'  Johnson={p_johnson.get("id","ERR")[:8]}  Spine={p_spine.get("id","ERR")[:8]}  Kim={p_kim.get("id","ERR")[:8]}')

# ── Leads ─────────────────────────────────────────────────────────────────────
print('Creating leads...')
l_w = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'Patricia', 'last_name': 'Williams', 'injury_type': 'auto', 'source': 'google', 'status': 'signed', 'phone': '702-555-1001', 'email': 'pwilliams@email.demo', 'created_at': days_ago(90)}, token)
l_c = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'James', 'last_name': 'Chen', 'injury_type': 'slip-fall', 'source': 'phone', 'status': 'intake-in-progress', 'phone': '702-555-1003', 'email': 'jchen@email.demo', 'created_at': days_ago(45)}, token)
l_r = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'Maria', 'last_name': 'Rodriguez', 'injury_type': 'auto', 'source': 'web-form', 'status': 'new', 'phone': '702-555-1002', 'email': 'mrodriguez@email.demo', 'created_at': days_ago(30)}, token)
l_t = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'Robert', 'last_name': 'Thompson', 'injury_type': 'dog-bite', 'source': 'sms', 'status': 'contacted', 'phone': '702-555-1004', 'email': 'rthompson@email.demo', 'created_at': days_ago(14)}, token)
l_d = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'Linda', 'last_name': 'Davis', 'injury_type': 'auto', 'source': 'phone', 'status': 'lost', 'phone': '702-555-1005', 'email': 'ldavis@email.demo', 'created_at': days_ago(60)}, token)
# Resurrection candidate 1: new, 45 days old, no comms
l_p = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'Marcus', 'last_name': 'Park', 'injury_type': 'premises-liability', 'source': 'web-form', 'status': 'new', 'phone': '702-555-1006', 'email': 'mpark@email.demo', 'created_at': days_ago(45)}, token)
# Resurrection candidate 2: contacted 35 days ago, gone cold
l_tor = api('POST', '/leads', {'firm_id': firm_id, 'first_name': 'Sofia', 'last_name': 'Torres', 'injury_type': 'auto', 'source': 'referral', 'status': 'contacted', 'phone': '702-555-1007', 'email': 'storres@email.demo', 'created_at': days_ago(38), 'last_contact_at': days_ago(35)}, token)
print(f'  Williams={l_w.get("id","ERR")[:8]}  Park={l_p.get("id","ERR")[:8]}  Torres={l_tor.get("id","ERR")[:8]}')

# ── Clients ───────────────────────────────────────────────────────────────────
print('Creating clients...')
c_w = api('POST', '/clients', {'firm_id': firm_id, 'first_name': 'Patricia', 'last_name': 'Williams', 'dob': '1985-03-12', 'phone': '702-555-1001', 'email': 'pwilliams@email.demo', 'insurance_carrier': 'State Farm', 'insurance_policy': 'SF-2024-9821', 'insurance_adjuster': 'Jennifer Walsh', 'adjuster_phone': '702-555-9001', 'injury_description': 'Rear-end collision causing whiplash and lumbar strain.'}, token)
c_r = api('POST', '/clients', {'firm_id': firm_id, 'first_name': 'Maria', 'last_name': 'Rodriguez', 'dob': '1990-07-22', 'phone': '702-555-1002', 'email': 'mrodriguez@email.demo', 'insurance_carrier': 'Allstate', 'insurance_policy': 'AL-2024-5543', 'insurance_adjuster': 'Kevin Alvarez', 'adjuster_phone': '702-555-9002', 'injury_description': 'T-bone collision causing cervical disc herniation and left shoulder impingement.'}, token)
c_c = api('POST', '/clients', {'firm_id': firm_id, 'first_name': 'James', 'last_name': 'Chen', 'dob': '1978-11-05', 'phone': '702-555-1003', 'email': 'jchen@email.demo', 'injury_description': 'Slip and fall on unmarked wet floor. Knee and wrist fractures confirmed via MRI.'}, token)
print(f'  Williams={c_w.get("id","ERR")[:8]}  Rodriguez={c_r.get("id","ERR")[:8]}  Chen={c_c.get("id","ERR")[:8]}')

# ── Cases ─────────────────────────────────────────────────────────────────────
print('Creating cases...')
case_w = api('POST', '/cases', {'firm_id': firm_id, 'lead_id': l_w['id'], 'client_id': c_w['id'], 'case_number': 'PI-2025-001', 'case_type': 'auto', 'status': 'negotiation', 'date_of_loss': '2024-01-15', 'sol_date': '2026-06-15', 'attorney_fee_pct': 33.33, 'description': 'Rear-end at Flamingo & Paradise. Defendant ran red light. Police report confirms fault.'}, token)
case_r = api('POST', '/cases', {'firm_id': firm_id, 'lead_id': l_r['id'], 'client_id': c_r['id'], 'case_number': 'PI-2025-002', 'case_type': 'auto', 'status': 'demand', 'date_of_loss': '2024-04-20', 'sol_date': '2026-09-20', 'attorney_fee_pct': 33.33, 'description': 'T-bone at Eastern Ave. Defendant failed to yield. Two pedestrian witnesses.'}, token)
case_c = api('POST', '/cases', {'firm_id': firm_id, 'lead_id': l_c['id'], 'client_id': c_c['id'], 'case_number': 'PI-2025-003', 'case_type': 'slip-fall', 'status': 'investigation', 'date_of_loss': '2025-01-10', 'sol_date': '2027-01-10', 'attorney_fee_pct': 33.33, 'description': 'Slip and fall at Desert Storage. No wet floor sign. Security footage preserved.'}, token)
print(f'  PI-2025-001={case_w.get("id","ERR")[:8]}  PI-2025-002={case_r.get("id","ERR")[:8]}  PI-2025-003={case_c.get("id","ERR")[:8]}')

# ── Medical Providers ─────────────────────────────────────────────────────────
print('Creating medical providers...')
for rec in [
    {'case_id': case_w['id'], 'name': 'Desert Orthopedics', 'provider_type': 'orthopedic', 'request_status': 'received', 'lien_amount': 12500},
    {'case_id': case_w['id'], 'name': 'Vegas Chiro & Rehab', 'provider_type': 'chiropractic', 'request_status': 'received', 'lien_amount': 8200},
    {'case_id': case_w['id'], 'name': 'Sunrise Imaging', 'provider_type': 'radiology', 'request_status': 'received', 'lien_amount': 3800},
    {'case_id': case_r['id'], 'name': 'Valley Emergency Hospital', 'provider_type': 'hospital', 'request_status': 'received', 'lien_amount': 22000},
    {'case_id': case_r['id'], 'name': 'Desert Physical Therapy', 'provider_type': 'physical_therapy', 'request_status': 'requested', 'lien_amount': 0},
    {'case_id': case_c['id'], 'name': 'Spring Valley Medical Center', 'provider_type': 'hospital', 'request_status': 'received', 'lien_amount': 15600},
    {'case_id': case_c['id'], 'name': 'Henderson Orthopedic Group', 'provider_type': 'orthopedic', 'request_status': 'requested', 'lien_amount': 0},
]:
    r = api('POST', '/medical_providers', {'firm_id': firm_id, **rec}, token)
    print(f'  {rec["name"]}: {r.get("id","ERR")[:8] if r.get("id") else "ERR"}')

# ── Tasks ─────────────────────────────────────────────────────────────────────
print('Creating tasks...')
tasks = [
    {'case_id': case_w['id'], 'title': 'SOL Deadline Monitor', 'task_type': 'sol', 'due_date': '2026-06-15', 'status': 'open'},
    {'case_id': case_w['id'], 'title': 'Review and send counter-demand to State Farm', 'task_type': 'demand', 'due_date': '2026-04-01', 'status': 'open'},
    {'case_id': case_w['id'], 'title': 'Follow up with adjuster Jennifer Walsh re: third offer', 'task_type': 'general', 'due_date': '2026-03-25', 'status': 'in-progress'},
    {'case_id': case_w['id'], 'title': 'Obtain signed disbursement authorization from client', 'task_type': 'general', 'due_date': '2026-02-28', 'status': 'completed'},
    {'case_id': case_r['id'], 'title': 'Request MRI records from Valley Emergency Hospital', 'task_type': 'general', 'due_date': '2026-04-01', 'status': 'open'},
    {'case_id': case_r['id'], 'title': 'Prepare and send demand letter to Allstate', 'task_type': 'demand', 'due_date': '2026-05-01', 'status': 'open'},
    {'case_id': case_r['id'], 'title': 'Confirm PT treatment plan with Desert Physical Therapy', 'task_type': 'general', 'due_date': '2026-04-10', 'status': 'in-progress'},
    {'case_id': case_c['id'], 'title': 'Complete signed client intake authorization forms', 'task_type': 'general', 'due_date': '2026-03-30', 'status': 'open'},
    {'case_id': case_c['id'], 'title': 'Order police/incident report from LVMPD', 'task_type': 'general', 'due_date': '2026-03-28', 'status': 'completed'},
    {'case_id': case_c['id'], 'title': 'Preserve security footage (litigation hold letter sent)', 'task_type': 'general', 'due_date': '2026-03-20', 'status': 'completed'},
]
for t in tasks:
    api('POST', '/tasks', {'firm_id': firm_id, **t}, token)
print(f'  {len(tasks)} tasks')

# ── Communications (NOT for Park/Torres resurrection candidates) ───────────────
print('Creating communications...')
comms = [
    {'lead_id': l_w['id'], 'channel': 'call', 'direction': 'outbound', 'message': 'Initial consultation. Client confirmed liability. Retainer signed.'},
    {'lead_id': l_w['id'], 'channel': 'sms', 'direction': 'outbound', 'message': 'Hi Patricia, your retainer is confirmed. We will be in touch shortly.'},
    {'lead_id': l_w['id'], 'channel': 'note', 'direction': 'outbound', 'message': 'Demand letter sent to State Farm adjuster Jennifer Walsh. Demand: $125,000. Ref: SF-CLAIM-2024-48821.'},
    {'lead_id': l_w['id'], 'channel': 'note', 'direction': 'inbound', 'message': 'State Farm initial offer: $45,000. Rejected per client. Counter-demand sent at $95,000.'},
    {'lead_id': l_w['id'], 'channel': 'call', 'direction': 'inbound', 'message': 'Jennifer Walsh called. Second offer: $62,000. Client instructed to counter at $85,000.'},
    {'lead_id': l_w['id'], 'channel': 'note', 'direction': 'outbound', 'message': 'Defense final offer: $72,000. Client accepted at mediation. Disbursement authorization obtained.'},
    {'lead_id': l_r['id'], 'channel': 'call', 'direction': 'outbound', 'message': 'Initial consultation complete. Liability clear — defendant ran stop sign, 2 pedestrian witnesses.'},
    {'lead_id': l_r['id'], 'channel': 'sms', 'direction': 'outbound', 'message': 'Hi Maria, we have started medical records requests. You will hear from us by Friday.'},
    {'lead_id': l_r['id'], 'channel': 'note', 'direction': 'outbound', 'message': 'Records request sent to Valley Emergency Hospital and Desert Physical Therapy.'},
    {'lead_id': l_r['id'], 'channel': 'note', 'direction': 'inbound', 'message': 'Valley Emergency records received — 3 ER visits, surgery referral, $22,000 in charges.'},
    {'lead_id': l_c['id'], 'channel': 'call', 'direction': 'outbound', 'message': 'Intake call. Client described fall at Desert Storage. No wet floor sign present.'},
    {'lead_id': l_c['id'], 'channel': 'note', 'direction': 'outbound', 'message': 'Scene investigation complete. Security footage preserved via litigation hold.'},
    {'lead_id': l_c['id'], 'channel': 'note', 'direction': 'inbound', 'message': 'Facility owner denied liability. Responding with evidence — proceeding to file suit.'},
    {'lead_id': l_c['id'], 'channel': 'sms', 'direction': 'outbound', 'message': 'James, suit has been filed. Discovery phase starts next. Will schedule a call this week.'},
    {'lead_id': l_t['id'], 'channel': 'sms', 'direction': 'outbound', 'message': 'Hi Robert, this is Demo Law Firm. We received your inquiry about your dog bite injury.'},
    {'lead_id': l_t['id'], 'channel': 'sms', 'direction': 'inbound', 'message': 'Yes, can we talk Thursday afternoon?'},
]
for comm in comms:
    api('POST', '/communications', {'firm_id': firm_id, 'status': 'sent', **comm}, token)
print(f'  {len(comms)} comms (Park/Torres untouched for resurrection queue)')

# ── Settlement Offers ─────────────────────────────────────────────────────────
print('Creating settlement offers...')
for o in [
    {'offer_by': 'defense', 'amount': 45000, 'offered_at': '2025-12-01T00:00:00Z', 'accepted': False, 'notes': 'Initial lowball from State Farm.'},
    {'offer_by': 'plaintiff', 'amount': 125000, 'offered_at': '2025-12-15T00:00:00Z', 'accepted': False, 'notes': 'Demand letter amount.'},
    {'offer_by': 'defense', 'amount': 62000, 'offered_at': '2026-01-10T00:00:00Z', 'accepted': False, 'notes': 'Second offer — below floor.'},
    {'offer_by': 'plaintiff', 'amount': 85000, 'offered_at': '2026-01-20T00:00:00Z', 'accepted': False, 'notes': 'Counter — adjusted for documented specials.'},
    {'offer_by': 'defense', 'amount': 72000, 'offered_at': '2026-02-05T00:00:00Z', 'accepted': True, 'notes': 'Final accepted at mediation.'},
]:
    api('POST', '/settlement_offers', {'firm_id': firm_id, 'case_id': case_w['id'], **o}, token)
api('POST', '/settlement_offers', {'firm_id': firm_id, 'case_id': case_r['id'], 'offer_by': 'plaintiff', 'amount': 95000, 'offered_at': '2026-03-01T00:00:00Z', 'accepted': False, 'notes': 'Initial demand to Allstate based on medicals + wage loss.'}, token)
print('  6 offers')

# ── Case Costs ────────────────────────────────────────────────────────────────
print('Creating case costs...')
for cost in [
    {'case_id': case_w['id'], 'cost_type': 'medical_lien', 'description': 'Desert Orthopedics lien', 'amount': 12500, 'paid': True},
    {'case_id': case_w['id'], 'cost_type': 'medical_lien', 'description': 'Vegas Chiro & Rehab lien', 'amount': 8200, 'paid': False},
    {'case_id': case_w['id'], 'cost_type': 'medical_lien', 'description': 'Sunrise Imaging lien', 'amount': 3800, 'paid': False},
    {'case_id': case_w['id'], 'cost_type': 'filing_fee', 'description': 'Clark County District Court filing fee', 'amount': 435, 'paid': True},
    {'case_id': case_w['id'], 'cost_type': 'expert_fee', 'description': 'Accident reconstruction expert — Dr. Timothy Cole', 'amount': 3500, 'paid': False},
    {'case_id': case_w['id'], 'cost_type': 'investigation', 'description': 'Scene documentation and photography', 'amount': 850, 'paid': True},
    {'case_id': case_r['id'], 'cost_type': 'investigation', 'description': 'Accident scene photos and witness statements', 'amount': 600, 'paid': True},
    {'case_id': case_r['id'], 'cost_type': 'filing_fee', 'description': 'Clark County filing fee', 'amount': 435, 'paid': False},
    {'case_id': case_c['id'], 'cost_type': 'investigation', 'description': 'Security footage preservation and scene documentation', 'amount': 750, 'paid': True},
]:
    api('POST', '/case_costs', {'firm_id': firm_id, **cost}, token)
print('  9 costs')

# ── Case Settlement ───────────────────────────────────────────────────────────
print('Creating case settlement...')
api('POST', '/case_settlements', {'firm_id': firm_id, 'case_id': case_w['id'], 'gross_settlement': 72000, 'attorney_fee_pct': 33.33, 'costs_total': 29285, 'settled_at': '2026-02-10T00:00:00Z', 'notes': 'Settled at mediation Feb 10. Fee: $23,998. Costs: $29,285. Client net: $18,717.'}, token)

# ── Partner Referrals ─────────────────────────────────────────────────────────
print('Creating partner referrals...')
api('POST', '/partner_referrals', {'firm_id': firm_id, 'partner_id': p_johnson['id'], 'lead_id': l_r['id'], 'commission_pct': 25, 'commission_amount': 0, 'commission_paid': False, 'notes': 'Referred via attorney network. High-value case.'}, token)
api('POST', '/partner_referrals', {'firm_id': firm_id, 'partner_id': p_johnson['id'], 'case_id': case_w['id'], 'commission_pct': 0, 'commission_amount': 2000, 'commission_paid': True, 'notes': 'Flat referral fee paid at settlement. Check #1042.'}, token)
api('POST', '/partner_referrals', {'firm_id': firm_id, 'partner_id': p_spine['id'], 'lead_id': l_c['id'], 'commission_pct': 0, 'commission_amount': 0, 'commission_paid': False, 'notes': 'Patient referred from chiro intake.'}, token)
api('POST', '/partner_referrals', {'firm_id': firm_id, 'partner_id': p_kim['id'], 'case_id': case_w['id'], 'commission_pct': 0, 'commission_amount': 500, 'commission_paid': False, 'notes': 'Expert review fee for radiology interpretation.'}, token)
print('  4 referrals')

# ── Portal Account ────────────────────────────────────────────────────────────
print('Creating portal account...')
portal = api('POST', '/portal-register', {'client_id': c_w['id'], 'email': 'portal@williams.demo', 'password': 'Portal2026!'}, token, base=AUTH_BASE)
print(f'  portal-register: {portal}')

print('\n=== DEMO GENERATION COMPLETE ===')
print('Portal login: portal@williams.demo / Portal2026! (firm slug: demo)')
