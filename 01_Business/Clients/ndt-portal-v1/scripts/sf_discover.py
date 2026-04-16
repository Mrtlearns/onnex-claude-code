#!/usr/bin/env python3
"""
Salesforce Schema Discovery — gap analysis tool.

Enumerates all queryable SF objects and their fields via the Describe API,
then compares against the objects and fields currently synced by sf_sync.py.

Outputs a structured JSON report to outputs/sf_discovery_YYYY-MM-DD.json with:
  - unmapped_custom_objects  : all __c objects with full field lists
  - unmapped_standard_objects: relevant standard objects not currently synced
  - field_gaps               : per-synced-object diff of available vs queried fields
  - summary                  : counts and top findings

Usage:
  python3 sf_discover.py
  python3 sf_discover.py --out path/to/output.json
  python3 sf_discover.py --object BOM__c   # describe a single object

Credentials (same env vars as sf_sync.py):
  SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date


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


# ─── REST helpers ─────────────────────────────────────────────────────────────

def sf_get(instance_url: str, token: str, path: str) -> dict:
    url = f'{instance_url}/services/data/v59.0{path}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))


# ─── Currently synced objects and their SOQL field lists ─────────────────────
# Keep in sync with sf_sync.py queries.

SYNCED_FIELDS: dict[str, list[str]] = {
    'Account': [
        'Id', 'Name', 'Type', 'Primary_Market__c', 'Account_Status__c',
        'Primary_Approvals__c', 'Rate_Sheet_on_File__c', 'Payment_Terms__c',
        'YTD_Account_Toal__c',
    ],
    'Opportunity': [
        'Id', 'AccountId', 'Account.Name', 'Project_Number__c', 'Invoice_No__c',
        'Invoice_Amount__c', 'Part_No__c', 'Rev_No__c', 'Lot_Batch_Serial_No__c',
        'Service__c', 'Specification__c', 'NDT_Procedure__c', 'Acceptance_Criteria__c',
        'Scope__c', 'PO__c', 'Price_Per__c', 'Date_Received_Lab__c',
        'Date_Completed_Lab__c', 'RecordType.Name', 'CloseDate',
    ],
    'Quote': [
        'Id', 'OpportunityId', 'AccountId', 'QuoteNumber', 'Part_Number__c',
        'Includes__c', 'GrandTotal', 'Status', 'ExpirationDate', 'Per__c',
        'Notes__c', 'Description', 'CreatedDate',
    ],
    'QuoteLineItem': [
        'Id', 'QuoteId', 'Product2.ProductCode', 'Product2.Name', 'Product2.Family',
        'Quantity', 'UnitPrice', 'ListPrice', 'TotalPrice', 'Description__c',
        'LineNumber',
    ],
    'Product2': [
        'Id', 'ProductCode', 'Name', 'Family', 'Description', 'IsActive',
    ],
}

# Standard SF objects not currently synced — check for presence
STANDARD_OBJECTS_OF_INTEREST = [
    'Contact', 'Contract', 'Order', 'OrderItem', 'Case', 'Asset',
    'PricebookEntry', 'Pricebook2', 'Task', 'Event', 'Lead',
    'ContentDocument', 'ContentVersion', 'Attachment',
]

# Field types that are analytically relevant (skip formula-only, system, binary fields)
SKIP_FIELD_TYPES = {'base64', 'JunctionIdList'}
SKIP_FIELD_PREFIXES = ('SystemModstamp', 'IsDeleted', 'LastModified', 'LastActivity',
                       'LastReferenced', 'LastViewed', 'LastCRM', 'Jigsaw',
                       'PhotoUrl', 'Masterrecord', 'MasterRecord')


def is_useful_field(field: dict) -> bool:
    """Filter out system/binary fields that add noise to the gap report."""
    if field.get('type') in SKIP_FIELD_TYPES:
        return False
    name = field.get('name', '')
    if any(name.startswith(p) for p in SKIP_FIELD_PREFIXES):
        return False
    return True


def describe_object(instance_url: str, token: str, obj_name: str) -> dict | None:
    """Describe a single SF object. Returns None if not accessible."""
    try:
        data = sf_get(instance_url, token, f'/sobjects/{obj_name}/describe/')
        fields = [
            {
                'name':     f['name'],
                'label':    f['label'],
                'type':     f['type'],
                'custom':   f.get('custom', False),
                'nillable': f.get('nillable', True),
            }
            for f in data.get('fields', [])
            if is_useful_field(f)
        ]
        return {
            'name':        data.get('name'),
            'label':       data.get('label'),
            'queryable':   data.get('queryable', False),
            'custom':      data.get('custom', False),
            'field_count': len(fields),
            'fields':      fields,
        }
    except urllib.error.HTTPError as e:
        if e.code in (404, 400):
            return None  # Object doesn't exist in this org
        raise


# ─── Gap analysis ────────────────────────────────────────────────────────────

def compute_field_gaps(instance_url: str, token: str) -> dict[str, dict]:
    """
    For each currently-synced object, find fields available in SF that we
    don't currently query. Returns dict keyed by object name.
    """
    gaps: dict[str, dict] = {}
    for obj_name, queried in SYNCED_FIELDS.items():
        print(f'  [gap] Describing {obj_name}...')
        described = describe_object(instance_url, token, obj_name)
        if not described:
            gaps[obj_name] = {'error': 'Object not accessible'}
            continue

        queried_normalized = {f.split('.')[-1].lower() for f in queried}
        missing = [
            f for f in described['fields']
            if f['name'].lower() not in queried_normalized
        ]

        # Prioritise: custom fields + commonly useful standard fields
        useful_missing = [
            f for f in missing
            if f['custom'] or f['name'] in (
                'StageName', 'Amount', 'IsWon', 'IsClosed', 'Probability',
                'OwnerId', 'CreatedDate', 'LastModifiedDate', 'Description',
                'BillingState', 'BillingCountry', 'BillingCity', 'Phone',
                'Industry', 'Website', 'NumberOfEmployees',
                'ContactId', 'OpportunityId', 'AccountId',
                'StartDate', 'EndDate', 'ContractNumber', 'Status',
                'OrderNumber', 'EffectiveDate', 'TotalAmount',
            )
        ]

        gaps[obj_name] = {
            'total_fields_in_sf': described['field_count'],
            'currently_queried':  len(queried),
            'missing_count':      len(missing),
            'useful_missing':     useful_missing,
            'all_missing':        missing,
        }

    return gaps


def discover_unmapped_objects(instance_url: str, token: str) -> tuple[list, list]:
    """
    List all queryable SF objects and split into:
    - unmapped custom objects (__c)
    - unmapped standard objects of interest
    """
    print('  [discover] Listing all SF objects...')
    data = sf_get(instance_url, token, '/sobjects/')
    all_objects = data.get('sobjects', [])

    synced_names_lower = {n.lower() for n in SYNCED_FIELDS}
    standard_interest_lower = {n.lower() for n in STANDARD_OBJECTS_OF_INTEREST}

    custom_unmapped: list[dict] = []
    standard_unmapped: list[dict] = []

    queryable = [o for o in all_objects if o.get('queryable') and not o.get('deprecatedAndHidden')]

    for obj in queryable:
        name = obj.get('name', '')
        name_lower = name.lower()

        if name_lower in synced_names_lower:
            continue  # Already synced

        if name.endswith('__c'):
            # Custom object — describe it fully
            print(f'  [custom] Describing {name}...')
            described = describe_object(instance_url, token, name)
            if described:
                custom_unmapped.append(described)

        elif name_lower in standard_interest_lower:
            # Standard object of interest — describe it
            print(f'  [standard] Describing {name}...')
            described = describe_object(instance_url, token, name)
            if described:
                standard_unmapped.append(described)

    return custom_unmapped, standard_unmapped


def build_suggested_soql(obj: dict) -> str:
    """Generate a starter SOQL SELECT from the described fields."""
    fields = [f['name'] for f in obj['fields'] if f['type'] not in ('address',)]
    # Cap at 50 fields to avoid hitting SOQL limits
    field_list = ', '.join(fields[:50])
    return f"SELECT {field_list} FROM {obj['name']}"


# ─── Single-object describe mode ─────────────────────────────────────────────

def describe_single(instance_url: str, token: str, obj_name: str):
    """Print full field list for one object (useful for inspecting BOM object)."""
    print(f'\nDescribing {obj_name}...\n')
    described = describe_object(instance_url, token, obj_name)
    if not described:
        print(f'ERROR: {obj_name} not found or not accessible in this org.')
        sys.exit(1)

    print(f'Object : {described["label"]} ({described["name"]})')
    print(f'Fields : {described["field_count"]}')
    print(f'Custom : {described["custom"]}')
    print()
    print(f'{"Field Name":<45} {"Type":<20} {"Label"}')
    print('-' * 90)
    for f in described['fields']:
        custom_marker = ' *' if f['custom'] else ''
        print(f'{f["name"] + custom_marker:<45} {f["type"]:<20} {f["label"]}')

    print()
    print('Suggested SOQL:')
    print(build_suggested_soql(described))


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Salesforce schema discovery and gap analysis')
    parser.add_argument('--out', default=None,
                        help='Output JSON path (default: outputs/sf_discovery_YYYY-MM-DD.json)')
    parser.add_argument('--object', default=None,
                        help='Describe a single object and exit (e.g. --object BOM__c)')
    args = parser.parse_args()

    instance_url  = os.environ.get('SF_INSTANCE_URL', '').rstrip('/')
    client_id     = os.environ.get('SF_CLIENT_ID', '')
    client_secret = os.environ.get('SF_CLIENT_SECRET', '')

    if not all([instance_url, client_id, client_secret]):
        print('ERROR: SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET must be set')
        sys.exit(1)

    print('[sf-discover] Authenticating...')
    token = get_sf_token(instance_url, client_id, client_secret)
    print('[sf-discover] Token obtained')

    # ── Single-object mode ───────────────────────────────────────────────────
    if args.object:
        describe_single(instance_url, token, args.object)
        return

    # ── Full discovery mode ──────────────────────────────────────────────────
    print('\n[sf-discover] Phase 1: Field gaps on synced objects')
    field_gaps = compute_field_gaps(instance_url, token)

    print('\n[sf-discover] Phase 2: Unmapped object discovery')
    custom_unmapped, standard_unmapped = discover_unmapped_objects(instance_url, token)

    # Add suggested SOQL to each object
    for obj in custom_unmapped + standard_unmapped:
        obj['suggested_soql'] = build_suggested_soql(obj)

    # ── Build summary ────────────────────────────────────────────────────────
    total_useful_field_gaps = sum(
        len(v.get('useful_missing', []))
        for v in field_gaps.values()
        if isinstance(v, dict)
    )

    summary = {
        'run_date':                     str(date.today()),
        'synced_objects':               list(SYNCED_FIELDS.keys()),
        'unmapped_custom_count':        len(custom_unmapped),
        'unmapped_standard_count':      len(standard_unmapped),
        'total_useful_field_gaps':      total_useful_field_gaps,
        'custom_object_names':          [o['name'] for o in custom_unmapped],
        'standard_object_names':        [o['name'] for o in standard_unmapped],
        'objects_with_field_gaps':      {
            k: v['missing_count']
            for k, v in field_gaps.items()
            if isinstance(v, dict) and v.get('missing_count', 0) > 0
        },
    }

    report = {
        'summary':                  summary,
        'field_gaps':               field_gaps,
        'unmapped_custom_objects':  custom_unmapped,
        'unmapped_standard_objects': standard_unmapped,
    }

    # ── Write output ─────────────────────────────────────────────────────────
    out_path = args.out
    if not out_path:
        outputs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs')
        os.makedirs(outputs_dir, exist_ok=True)
        out_path = os.path.join(outputs_dir, f'sf_discovery_{date.today()}.json')

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, default=str)

    print(f'\n[sf-discover] COMPLETE')
    print(f'  Custom objects found    : {len(custom_unmapped)}')
    print(f'  Standard objects found  : {len(standard_unmapped)}')
    print(f'  Useful field gaps       : {total_useful_field_gaps}')
    print(f'  Custom object names     : {", ".join(o["name"] for o in custom_unmapped) or "none"}')
    print(f'\nReport written to: {out_path}')
    print('\nNext steps:')
    print('  1. Review the report — find the BOM object in custom_object_names')
    print('  2. Run: python3 sf_discover.py --object <BOM_OBJECT_NAME> for full field list')
    print('  3. Update postgres/migrations/024_sf_custom_objects.sql with confirmed field names')
    print('  4. Update sf_sync.py sync_bom_items() SOQL with the confirmed field names')


if __name__ == '__main__':
    main()
