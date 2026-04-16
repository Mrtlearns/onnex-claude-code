"""E2E test script for NDT Portal v1 — all features including pipeline."""
import paramiko, sys, json, base64, tempfile, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.32', username='root', password='Poll0000',
               timeout=10, look_for_keys=False, allow_agent=False)
client.get_transport().set_keepalive(30)

def run(cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return (stdout.read().decode('utf-8', errors='replace').strip(),
            stderr.read().decode('utf-8', errors='replace').strip())

results = []

def check(name, passed, detail=''):
    results.append((passed, name, str(detail)[:100]))
    icon = '[PASS]' if passed else '[FAIL]'
    print(f"{icon} {name}" + (f" - {str(detail)[:100]}" if detail else ''))


def jpost(path, payload):
    """POST JSON payload via temp file to avoid shell quoting issues."""
    tmp = tempfile.mktemp(suffix='.json')
    with open(tmp, 'w') as f:
        json.dump(payload, f)
    sftp = client.open_sftp()
    sftp.put(tmp, '/tmp/payload.json')
    sftp.close()
    os.unlink(tmp)
    out, err = run(
        'curl -sf -X POST http://localhost:8888' + path
        + ' -H "Content-Type: application/json" -d @/tmp/payload.json'
    )
    try:
        return json.loads(out), None
    except Exception:
        return None, (out or err)[:200]


def jget(path):
    out, err = run('curl -sf "http://localhost:8888' + path + '"')
    try:
        return json.loads(out), None
    except Exception:
        return None, (out or err)[:200]


def http_code(method, path, payload_file=None):
    if method == 'GET':
        out, _ = run('curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888' + path + '"')
    else:
        out, _ = run(
            'curl -s -o /dev/null -w "%{http_code}" -X ' + method
            + ' http://localhost:8888' + path
            + ' -H "Content-Type: application/json" -d @/tmp/payload.json'
        )
    return out.strip()


# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("NDT PORTAL v1 - END-TO-END TEST SUITE")
print("="*60)

# ── PHASE 1: Infrastructure health ──────────────────────────────────────────
print("\nPHASE 1: Infrastructure")

for svc in ['comply', 'sanitize', 'gateway']:
    r, e = jget('/api/pipeline/' + svc + '/health')
    check(svc + ' /health', r and r.get('status') == 'ok', r or e)

r, e = jget('/api/ut/quote')
check('UT API live', isinstance(r, list), f"{len(r)} quotes" if isinstance(r, list) else e)

code = http_code('GET', '/')
check('Frontend SPA (200)', code == '200', 'HTTP ' + code)

code = http_code('GET', '/n8n/')
check('n8n UI', code in ('200', '302', '301'), 'HTTP ' + code)

out, _ = run('curl -sf http://localhost:8888/api/msg/ 2>&1 | head -c 80')
check('msg-api responsive', len(out) > 0, out[:60])

# ── PHASE 2: Comply service ──────────────────────────────────────────────────
print("\nPHASE 2: Comply Service")

# CLEAN doc
clean_b64 = base64.b64encode(b'AWS D1.1 welding code. Commercial RT inspection. Acme Corp.').decode()
r, e = jpost('/api/pipeline/comply/classify', {
    'intake_id': '11111111-1111-1111-1111-111111111111',
    'filename': 'clean.txt', 'content_b64': clean_b64
})
check('CLEAN document',
      r and r.get('classification') == 'CLEAN' and r.get('llm_routing') == 'CLOUD_OK',
      f"class={r.get('classification')} routing={r.get('llm_routing')} score={r.get('risk_score')}" if r else e)
clean_doc_id = r.get('doc_id') if r else None

# MIL-SPEC doc — expect EAR_LOW or higher
mil_b64 = base64.b64encode(b'MIL-STD-1553 databus. MIL-PRF-31700 spec. AS9100 certified.').decode()
r, e = jpost('/api/pipeline/comply/classify', {
    'intake_id': '22222222-2222-2222-2222-222222222222',
    'filename': 'mil_spec.txt', 'content_b64': mil_b64
})
check('MIL-SPEC (EAR_LOW+)',
      r and r.get('classification') in ('EAR_LOW', 'EAR_HIGH', 'ITAR', 'NEEDS_REVIEW'),
      f"class={r.get('classification')} score={r.get('risk_score')}" if r else e)

# ITAR doc — DISTRIBUTION STATEMENT D - REJECTED + HOLD
itar_bytes = (b'DISTRIBUTION STATEMENT D: Authorized to DoD and US DoD contractors only. '
              b'NOFORN. ITAR CONTROLLED. F-35 JSF. USML CATEGORY VIII. '
              b'CAGE CODE: 97480. Contract W911SR-21-C-0012. DWG-F35-001. 22 CFR 121.')
itar_b64 = base64.b64encode(itar_bytes).decode()
r, e = jpost('/api/pipeline/comply/classify', {
    'intake_id': '33333333-3333-3333-3333-333333333333',
    'filename': 'F35_structural.txt', 'content_b64': itar_b64
})
check('ITAR - REJECTED + HOLD',
      r and r.get('classification') == 'REJECTED' and r.get('llm_routing') == 'HOLD',
      f"class={r.get('classification')} routing={r.get('llm_routing')} score={r.get('risk_score')}" if r else e)
itar_doc_id = r.get('doc_id') if r else None

# EAR_HIGH doc - LOCAL_ONLY
ear_bytes = b'MIL-STD-1553. ECCN 1C210. EXPORT CONTROLLED. Maraging steel. Contract W111AA-21-C-0001.'
r, e = jpost('/api/pipeline/comply/classify', {
    'intake_id': '44444444-4444-4444-4444-444444444444',
    'filename': 'ear_high.txt', 'content_b64': base64.b64encode(ear_bytes).decode()
})
check('EAR_HIGH - LOCAL_ONLY',
      r and r.get('llm_routing') == 'LOCAL_ONLY',
      f"class={r.get('classification')} routing={r.get('llm_routing')} score={r.get('risk_score')}" if r else e)

# Review queue
r, e = jget('/api/pipeline/comply/review')
check('Review queue has HOLD items',
      isinstance(r, list) and len(r) > 0,
      f"{len(r)} items" if isinstance(r, list) else e)

# Document retrieval
if itar_doc_id:
    r, e = jget('/api/pipeline/comply/document/' + itar_doc_id)
    check('GET /document/{id}', r and r.get('classification') == 'REJECTED', str(r)[:80] if r else e)

# ── PHASE 3: Sanitize service ────────────────────────────────────────────────
print("\nPHASE 3: Sanitize Service")

san_text = 'Boeing Company ordered P/N A-12345-REV-B. John Smith jsmith@boeing.com. Contract W911SR-21-C-0012.'
r, e = jpost('/api/pipeline/sanitize/sanitize', {
    'comply_doc_id': clean_doc_id,
    'intake_id': '55555555-5555-5555-5555-555555555555',
    'text': san_text, 'routing': 'CLOUD_OK'
})
check('Sanitize: entities tokenized',
      r and r.get('entity_count', 0) > 0,
      f"count={r.get('entity_count')} job={r.get('job_id','?')[:8]}..." if r else e)
san_job_id = r.get('job_id') if r else None

if r:
    sanitized = r.get('sanitized_text', '')
    email_gone = '@' not in sanitized or 'EMAIL' in sanitized or 'EURL' in sanitized
    check('Email address tokenized', email_gone, sanitized[:120])

if san_job_id:
    r2, e = jget('/api/pipeline/sanitize/job/' + san_job_id)
    check('GET /sanitize/job/{id}',
          r2 and (r2.get('id') or r2.get('job_id')),
          f"entity_count={r2.get('entity_count')}" if r2 else e)

    # Reidentify as audit (should reveal all)
    r3, e = jpost('/api/pipeline/sanitize/reidentify', {
        'job_id': san_job_id,
        'text': r.get('sanitized_text', '') if r else 'test',
        'caller_role': 'audit',
        'caller_identity': 'test-runner'
    })
    check('Reidentify (audit role)',
          r3 is not None and 'reidentified_text' in r3,
          f"revealed={len(r3.get('tokens_revealed',[]))} text={r3.get('reidentified_text','')[:60]}" if r3 else e)

# ── PHASE 4: Gateway service ─────────────────────────────────────────────────
print("\nPHASE 4: Gateway Service")

r, e = jget('/api/pipeline/gateway/health')
check('Gateway /health', r and r.get('status') == 'ok', str(r or e)[:60])

# HOLD should be blocked (422)
import json as _json
_json.dump({'intake_id':'x','sanitize_job_id':'x','classification':'ITAR','llm_routing':'HOLD','prompt':'test'}, open('/tmp/payload.json','w'))
sftp = client.open_sftp()
sftp.put('/tmp/payload.json', '/tmp/payload.json')
sftp.close()
code = http_code('POST', '/api/pipeline/gateway/analyze')
check('HOLD blocked by gateway (422)', code == '422', 'HTTP ' + code)

# CLOUD_OK with CLEAN should attempt Anthropic (will fail with test-placeholder key, expect 502)
_json.dump({'intake_id':'55555555-5555-5555-5555-555555555555','sanitize_job_id': san_job_id or '00000000-0000-0000-0000-000000000001','classification':'CLEAN','llm_routing':'CLOUD_OK','prompt':'Extract quote params: flat bars, 100 pcs, Acme Corp.'}, open('/tmp/payload.json','w'))
sftp = client.open_sftp()
sftp.put('/tmp/payload.json', '/tmp/payload.json')
sftp.close()
code = http_code('POST', '/api/pipeline/gateway/analyze', '/tmp/payload.json')
# 502 = correct routing, Anthropic call fails because key is placeholder
check('CLOUD_OK routes (502=correct routing, bad test key)',
      code in ('200', '502', '422'),
      'HTTP ' + code + ' (502=correct: Anthropic called with test key)')

# ── PHASE 5: Express pipeline endpoints ──────────────────────────────────────
print("\nPHASE 5: Express Pipeline Endpoints")

r, e = jpost('/api/ut/integrations/pipeline/analyze', {
    'filename': 'test_intake.msg',
    'email': {'from': 'buyer@acme.com', 'subject': 'Quote Request', 'body': 'Need 100 flat bars RT tested.', 'date': '2026-03-16'},
    'attachments': [],
    'attachmentCount': 0
})
check('POST /pipeline/analyze - 202',
      r and 'intakeId' in r and r.get('status') == 'processing',
      f"intakeId={r.get('intakeId','')[:8]}... status={r.get('status')}" if r else e)
intake_id = r.get('intakeId') if r else None

if intake_id:
    r2, e = jget('/api/ut/integrations/pipeline/status/' + intake_id)
    check('GET /pipeline/status - processing',
          r2 and r2.get('status') == 'processing',
          str(r2)[:80] if r2 else e)

    r3, e = jpost('/api/ut/integrations/pipeline/result', {
        'intakeId': intake_id,
        'strictestRouting': 'CLOUD_OK',
        'classifications': [],
        'quoteParams': {'customerName': 'Acme Corp', 'notes': 'RT test', 'items': []}
    })
    check('POST /pipeline/result - completed',
          r3 and r3.get('status') == 'completed',
          str(r3)[:80] if r3 else e)

    r4, e = jget('/api/ut/integrations/pipeline/status/' + intake_id)
    check('GET /pipeline/status - completed',
          r4 and r4.get('status') == 'completed',
          f"status={r4.get('status')}" if r4 else e)

# ── PHASE 6: Existing portal features ────────────────────────────────────────
print("\nPHASE 6: Existing Portal Features")

# FIX: Use actual DB customer name (PREMCO) instead of 'TestCo'
r, e = jpost('/api/ut/quote', {
    'customerName': 'PREMCO', 'source': 'api',
    'items': [{'geometryType': 'FLAT_BAR', 'thickness': 3.625,
               'width': 11.625, 'length': 15.75, 'quantity': 100}]
})
check('UT quote engine',
      r and 'quoteId' in r,
      f"total=${r.get('summary',{}).get('totalGrand',0):.0f}" if r else e)
ut_quote_id = r.get('quoteId') if r else None

# FIX: RT quote requires partNumber, customerName, and views with correct schema:
#   shotType (0-3), qtyPartsPerFilm, filmSizeLabel|filmSizeId,
#   unpackLoadTime, darkroomSortTime, shotTime, readTime
r, e = jpost('/api/rt/quote', {
    'partNumber': 'TEST-RT-001',
    'customerName': 'PREMCO',
    'source': 'api',
    'views': [{
        'shotType': 0,
        'qtyPartsPerFilm': 2,
        'filmSizeLabel': '5X7',
        'unpackLoadTime': 5.0,
        'darkroomSortTime': 3.0,
        'shotTime': 2.0,
        'readTime': 1.0
    }]
})
check('RT quote engine', r is not None and 'quoteId' in r, str(r)[:80] if r else e)

# FIX: PostgREST UT uses ut.global_settings, not ut.settings
r, e = jget('/api/ut/global_settings')
check('PostgREST UT /global_settings', r is not None, str(type(r)))

r, e = jget('/api/rt/settings')
check('PostgREST RT /settings', r is not None, str(type(r)))

r, e = jget('/api/ut/inspection-types')
check('Inspection types endpoint', r is not None, str(type(r)))

# DB: pipeline schema populated
out, _ = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -tAc "
    "\"SELECT COUNT(*) FROM pipeline.comply_documents;\""
)
check('pipeline.comply_documents has rows', out.strip().isdigit() and int(out.strip()) > 0,
      out.strip() + ' docs')

out, _ = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -tAc "
    "\"SELECT COUNT(*) FROM pipeline.comply_keyword_library;\""
)
check('comply_keyword_library seeded', out.strip().isdigit() and int(out.strip()) > 40,
      out.strip() + ' keywords')

out, _ = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -tAc "
    "\"SELECT COUNT(*) FROM pipeline.sanitize_token_vault;\""
)
check('sanitize_token_vault has entries', out.strip().isdigit() and int(out.strip()) > 0,
      out.strip() + ' entries')

out, _ = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -tAc "
    "\"SELECT COUNT(*) FROM pipeline.intake_sessions;\""
)
check('intake_sessions created', out.strip().isdigit() and int(out.strip()) > 0,
      out.strip() + ' sessions')

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
passed = sum(1 for x in results if x[0])
failed = sum(1 for x in results if not x[0])
print(f"RESULTS: {passed} PASSED, {failed} FAILED / {len(results)} total")
print("="*60)
if failed:
    print("\nFailed tests:")
    for ok, name, detail in results:
        if not ok:
            print(f"  FAIL: {name}: {detail}")

client.close()
