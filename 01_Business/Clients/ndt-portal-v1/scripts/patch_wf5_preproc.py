"""
Patch WF-5 to surface 00-Pre-Processing config from DB instead of hardcoded URLs.

Changes:
1. Insert new Code node "B: Fetch Pre-Processing Config" (000023) between
   "Extract Intake Data" and the Branch A/B split.
2. Convert "Branch A: Sanitize Email" (000003) from httpRequest → Code
   (URL resolved from preProcConfig['email_sanitization']).
3. Patch "Branch A: Gateway Analyze Email" (000004) — already Code, add URL
   resolution for email_llm_analysis gateway call.
4. Convert "Branch B: Comply Classify" (000008) from httpRequest → Code
   (URL resolved from preProcConfig['compliance_classification']).
5. Convert "Branch B: Sanitize Attachment" (000011) from httpRequest → Code
   (URL resolved from preProcConfig['pii_sanitization']).
"""
import json, re

WF5_PATH = "/opt/ndt-portal/n8n-workflows/WF-5-pipeline-orchestrator.json"

with open(WF5_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ──────────────────────────────────────────────────────────────────────────────
# Node definitions
# ──────────────────────────────────────────────────────────────────────────────

FETCH_PREPROC_NODE = {
    "id": "a1b2c3d4-0005-0005-0005-000000000023",
    "name": "B: Fetch Pre-Processing Config",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [600, 400],
    "parameters": {
        "jsCode": r"""// Fetch 00-PRE inspection type + its steps from DB via API.
// Builds preProcConfig map keyed by config.pipeline_key.
// Non-fatal: on any error, passes empty map — pipeline uses hardcoded fallbacks.

const ctx = $input.first().json;
const API = 'http://api:3100';

let preProcConfig = {};

try {
  const types = await this.helpers.httpRequest({
    method: 'GET', url: `${API}/inspection-types`,
  });
  const preType = (Array.isArray(types) ? types : []).find(t => t.code === '00-PRE');

  if (preType) {
    const steps = await this.helpers.httpRequest({
      method: 'GET', url: `${API}/inspection-types/${preType.id}/steps`,
    });
    for (const step of (Array.isArray(steps) ? steps : [])) {
      const key = step.config?.pipeline_key;
      if (key) preProcConfig[key] = step;
    }
  }
} catch (err) {
  // Non-fatal: pipeline continues with hardcoded defaults
  preProcConfig._error = err.message;
}

return [{ json: { ...ctx, preProcConfig } }];"""
    },
    "notes": "Fetches 00-PRE steps from DB; builds preProcConfig map keyed by pipeline_key.\nNon-fatal: any error leaves preProcConfig empty and pipeline uses hardcoded URLs."
}

SANITIZE_EMAIL_CODE = r"""// Branch A: Sanitize email body before LLM analysis.
// URL resolved from 00-PRE config; falls back to hardcoded URL.
const ctx = $input.first().json;
const preProcConfig = ctx.preProcConfig || {};
const stepCfg = preProcConfig['email_sanitization'];
const serviceUrl = (stepCfg?.is_active !== false && stepCfg?.webhook_url)
  ? stepCfg.webhook_url
  : 'http://sanitize:8011/sanitize';

const result = await this.helpers.httpRequest({
  method: 'POST',
  url: serviceUrl,
  headers: { 'Content-Type': 'application/json' },
  body: {
    comply_doc_id: null,
    intake_id: ctx.intakeId,
    text: ctx.emailText,
    routing: 'CLOUD_OK',
  },
  timeout: 30000,
});

return [{ json: result }];"""

COMPLY_CLASSIFY_CODE = r"""// Branch B: ITAR/EAR classification with OCR text extraction.
// URL resolved from 00-PRE config; falls back to hardcoded URL.
const ctx = $input.first().json;
const preProcConfig = $('B: Fetch Pre-Processing Config').first().json.preProcConfig || {};
const stepCfg = preProcConfig['compliance_classification'];
const serviceUrl = (stepCfg?.is_active !== false && stepCfg?.webhook_url)
  ? stepCfg.webhook_url
  : 'http://comply:8010/classify';

const result = await this.helpers.httpRequest({
  method: 'POST',
  url: serviceUrl,
  headers: { 'Content-Type': 'application/json' },
  body: {
    intake_id: ctx.intakeId,
    filename: ctx.filename,
    content_b64: ctx.content_b64,
  },
  timeout: 120000,
});

return [{ json: result }];"""

SANITIZE_ATTACH_CODE = r"""// Branch B: Tokenize drawing numbers, CAGE codes, entities before LLM.
// URL resolved from 00-PRE config; falls back to hardcoded URL.
const ctx = $input.first().json;
const preProcConfig = $('B: Fetch Pre-Processing Config').first().json.preProcConfig || {};
const stepCfg = preProcConfig['pii_sanitization'];
const serviceUrl = (stepCfg?.is_active !== false && stepCfg?.webhook_url)
  ? stepCfg.webhook_url
  : 'http://sanitize:8011/sanitize';

const result = await this.helpers.httpRequest({
  method: 'POST',
  url: serviceUrl,
  headers: { 'Content-Type': 'application/json' },
  body: {
    comply_doc_id: ctx.doc_id,
    intake_id: ctx.intake_id,
    text: ctx.doc_id + ' ' + ctx.filename + ' drawing ' + (ctx.drawing_number || ''),
    routing: ctx.llm_routing,
  },
  timeout: 30000,
});

return [{ json: result }];"""

# For node 000004, we need to inject URL resolution at the top of the existing code.
# The current code has hardcoded 'http://gateway:8012/analyze' used directly inline.
# We replace the inline URL string with a resolved one from preProcConfig.
EMAIL_LLM_URL_RESOLUTION = r"""// Resolve gateway URL from 00-PRE config; fall back to hardcoded.
const _preProcCfg = $('B: Fetch Pre-Processing Config').first().json.preProcConfig || {};
const _emailLlmStep = _preProcCfg['email_llm_analysis'];
const GATEWAY_URL_RESOLVED = (_emailLlmStep?.is_active !== false && _emailLlmStep?.webhook_url)
  ? _emailLlmStep.webhook_url
  : 'http://gateway:8012/analyze';

"""

# ──────────────────────────────────────────────────────────────────────────────
# Apply patches
# ──────────────────────────────────────────────────────────────────────────────

NODE_IDS = {
    "000002": "a1b2c3d4-0005-0005-0005-000000000002",
    "000003": "a1b2c3d4-0005-0005-0005-000000000003",
    "000004": "a1b2c3d4-0005-0005-0005-000000000004",
    "000008": "a1b2c3d4-0005-0005-0005-000000000008",
    "000011": "a1b2c3d4-0005-0005-0005-000000000011",
    "000023": "a1b2c3d4-0005-0005-0005-000000000023",
}

def patch_nodes(nodes):
    # Check if 000023 already inserted
    existing_ids = {n["id"] for n in nodes}
    if NODE_IDS["000023"] not in existing_ids:
        nodes.append(FETCH_PREPROC_NODE)
        print("  Added: B: Fetch Pre-Processing Config (000023)")

    for node in nodes:
        nid = node.get("id")

        # 000003: Convert Branch A: Sanitize Email from httpRequest → Code
        if nid == NODE_IDS["000003"]:
            node["type"] = "n8n-nodes-base.code"
            node["typeVersion"] = 2
            node["parameters"] = {"jsCode": SANITIZE_EMAIL_CODE}
            for k in ["webhookId", "sendHeaders", "headerParameters", "sendBody",
                      "bodyParameters", "specifyBody", "jsonBody", "onError"]:
                node.pop(k, None)
            print(f"  Converted: {node['name']} (httpRequest → Code)")

        # 000004: Patch Branch A: Gateway Analyze Email — inject URL resolution
        elif nid == NODE_IDS["000004"]:
            code = node["parameters"].get("jsCode", "")
            if "GATEWAY_URL_RESOLVED" not in code:
                # Inject resolution block at top, then replace the hardcoded URL in usage
                code = EMAIL_LLM_URL_RESOLUTION + code
                # Replace all occurrences of the hardcoded gateway URL string
                code = code.replace("'http://gateway:8012/analyze'", "GATEWAY_URL_RESOLVED")
                code = code.replace('"http://gateway:8012/analyze"', "GATEWAY_URL_RESOLVED")
                node["parameters"]["jsCode"] = code
                print(f"  Patched: {node['name']} (added email_llm_analysis URL resolution)")

        # 000008: Convert Branch B: Comply Classify from httpRequest → Code
        elif nid == NODE_IDS["000008"]:
            node["type"] = "n8n-nodes-base.code"
            node["typeVersion"] = 2
            node["parameters"] = {"jsCode": COMPLY_CLASSIFY_CODE}
            for k in ["webhookId", "sendHeaders", "headerParameters", "sendBody",
                      "specifyBody", "jsonBody", "onError"]:
                node.pop(k, None)
            print(f"  Converted: {node['name']} (httpRequest → Code)")

        # 000011: Convert Branch B: Sanitize Attachment from httpRequest → Code
        elif nid == NODE_IDS["000011"]:
            node["type"] = "n8n-nodes-base.code"
            node["typeVersion"] = 2
            node["parameters"] = {"jsCode": SANITIZE_ATTACH_CODE}
            for k in ["webhookId", "sendHeaders", "headerParameters", "sendBody",
                      "specifyBody", "jsonBody", "onError"]:
                node.pop(k, None)
            print(f"  Converted: {node['name']} (httpRequest → Code)")


def patch_connections(connections):
    # Old: "Extract Intake Data" → ["Branch A: Sanitize Email", "Branch B: Split Attachments"]
    # New: "Extract Intake Data" → ["B: Fetch Pre-Processing Config"]
    #      "B: Fetch Pre-Processing Config" → ["Branch A: Sanitize Email", "Branch B: Split Attachments"]

    extract_conn = connections.get("Extract Intake Data", {})
    if extract_conn:
        main = extract_conn.get("main", [[]])
        if main and len(main) > 0:
            targets = main[0]
            # Check if already patched
            if any(t["node"] == "B: Fetch Pre-Processing Config" for t in targets):
                print("  Connections: Extract Intake Data already patched — skipping")
                return

            # The old targets (Branch A + Branch B) go to the new node's output
            old_targets = targets  # [BranchA, BranchB] in same array

            # Extract Intake Data now fans to new node only
            connections["Extract Intake Data"]["main"] = [[
                {"node": "B: Fetch Pre-Processing Config", "type": "main", "index": 0}
            ]]

            # New node fans to original Branch A + Branch B targets
            connections["B: Fetch Pre-Processing Config"] = {
                "main": [old_targets]
            }

            print("  Connections: Extract Intake Data → B: Fetch Pre-Processing Config → [branches]")


print("Patching top-level nodes[]...")
patch_nodes(wf.get("nodes", []))

print("Patching connections[]...")
patch_connections(wf.get("connections", {}))

# pinData also contains a copy of nodes (may be null)
if wf.get("pinData") and isinstance(wf["pinData"], dict):
    pin_nodes = wf["pinData"].get("nodes")
    if isinstance(pin_nodes, list):
        print("Patching pinData nodes[]...")
        patch_nodes(pin_nodes)
    else:
        print("pinData has no nodes array — skipping")
else:
    print("pinData is null/absent — skipping")

with open(WF5_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Done. WF-5 patched successfully.")
