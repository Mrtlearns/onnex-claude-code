"""
Patch WF-5 to enrich step-update payloads with full prompt text and LLM response_json.

Changes:
1. Node 000004 (Branch A: Gateway Analyze Email)
   - requestPayload for email_llm: add `prompt` (sanitized email text, first 3000 chars)
     and `system_prompt`
   - responsePayload for email_llm success: add `response_json`

2. Node 000012 (Branch B: Gateway Analyze Attachment)
   - Final step-update requestPayload: add `prompt` (sanitized attachment text),
     `system_prompt` (first LLM step instruction), `sanitize_job_id`
   - responsePayload: add `response_json` (combined LLM output)

3. Node 000015 (Assemble Final Params)
   - Add requestPayload with assembled classification + quote param summary

4. Node 000018 (B: Detect Inspection Type Code)
   - Add requestPayload to comply_classify step-update (filename sent to comply)
"""
import json, re

WF5_PATH = "/opt/ndt-portal/n8n-workflows/WF-5-pipeline-orchestrator.json"

NODE_IDS = {
    "000004": "a1b2c3d4-0005-0005-0005-000000000004",
    "000012": "a1b2c3d4-0005-0005-0005-000000000012",
    "000015": "a1b2c3d4-0005-0005-0005-000000000015",
    "000018": "a1b2c3d4-0005-0005-0005-000000000018",
}

with open(WF5_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)


def patch_node_004(node):
    """Enrich email_llm requestPayload + responsePayload with prompt and response_json."""
    code = node["parameters"].get("jsCode", "")
    changed = False

    # 1. requestPayload for email_llm processing: add prompt and system_prompt
    old_req = "requestPayload: { intake_id: intakeId, sanitize_job_id: sanitizeResult.job_id, classification: 'CLEAN', llm_routing: 'CLOUD_OK' },"
    new_req = ("requestPayload: { intake_id: intakeId, sanitize_job_id: sanitizeResult.job_id, "
               "classification: 'CLEAN', llm_routing: 'CLOUD_OK', "
               "prompt: (sanitizeResult.sanitized_text || '').slice(0, 3000), "
               "system_prompt: 'You are an NDT quote analyst. Extract structured quote parameters from this email. "
               "Return JSON with: customerName (string), inspectionType (one of: UT, RT, MT, PT, ET, VT), "
               "notes (string), estimatedItems (array of objects with geometryType, quantity, description).' },")
    if old_req in code:
        code = code.replace(old_req, new_req)
        changed = True
        print(f"  004: added prompt+system_prompt to email_llm requestPayload")

    # 2. responsePayload for email_llm SUCCESS: add response_json
    # There are two responsePayload lines for llm_ok case and the else case — target the success one
    # Success branch has: responsePayload: { provider: llmResponse.provider_used, model: llmResponse.model_used, tokens: llmResponse.prompt_tokens },
    old_resp_ok = "responsePayload: { provider: llmResponse.provider_used, model: llmResponse.model_used, tokens: llmResponse.prompt_tokens },"
    new_resp_ok = ("responsePayload: { provider: llmResponse.provider_used, model: llmResponse.model_used, "
                   "tokens: llmResponse.prompt_tokens, "
                   "response_json: typeof llmResponse.response_json === 'string' ? llmResponse.response_json.slice(0, 5000) : JSON.stringify(llmResponse.response_json || {}).slice(0, 5000) },")
    if old_resp_ok in code:
        code = code.replace(old_resp_ok, new_resp_ok)
        changed = True
        print(f"  004: added response_json to email_llm success responsePayload")

    if changed:
        node["parameters"]["jsCode"] = code
    else:
        print(f"  004: no changes (already patched or code changed)")


def patch_node_012(node):
    """Enrich llm_analysis final step-update with full prompt and response_json."""
    code = node["parameters"].get("jsCode", "")
    changed = False

    old_req = "requestPayload: { intake_id: _piid, classification: complyResult.classification, llm_routing: complyResult.llm_routing },"
    new_req = ("requestPayload: { intake_id: _piid, sanitize_job_id: sanitizeJobId, "
               "classification: complyResult.classification, llm_routing: complyResult.llm_routing, "
               "prompt: (sanitizedText || '').slice(0, 3000), "
               "system_prompt: (llmSteps[0]?.instruction || defaultInstruction || '').slice(0, 500) },")
    if old_req in code:
        code = code.replace(old_req, new_req)
        changed = True
        print(f"  012: added prompt+system_prompt+sanitize_job_id to llm_analysis requestPayload")

    old_resp = "responsePayload: { provider: lastResponse?.provider_used, model: lastResponse?.model_used, tokens: totalTokens },"
    new_resp = ("responsePayload: { provider: lastResponse?.provider_used, model: lastResponse?.model_used, "
                "tokens: totalTokens, "
                "response_json: JSON.stringify(combinedOutput).slice(0, 5000), "
                "step_results: stepResults },")
    if old_resp in code:
        code = code.replace(old_resp, new_resp)
        changed = True
        print(f"  012: added response_json+step_results to llm_analysis responsePayload")

    if changed:
        node["parameters"]["jsCode"] = code
    else:
        print(f"  012: no changes (already patched or code changed)")


def patch_node_015(node):
    """Add requestPayload to assemble step-update with classifications summary."""
    code = node["parameters"].get("jsCode", "")

    if "requestPayload:" in code:
        print(f"  015: already has requestPayload — skipping")
        return

    old_block = (
        "      stepKey: 'assemble',\n"
        "      status: 'success',\n"
        "      log: `${strictest} · ${attachResults.length} attachment(s) · customer: ${customer} · type: ${itype}`,\n"
        "      detail: {\n"
        "        strictestRouting: strictest,\n"
        "        attachmentCount: attachResults.length,\n"
        "        customerName: customer,\n"
        "        inspectionType: itype,\n"
        "      },"
    )
    new_block = (
        "      stepKey: 'assemble',\n"
        "      status: 'success',\n"
        "      log: `${strictest} · ${attachResults.length} attachment(s) · customer: ${customer} · type: ${itype}`,\n"
        "      detail: {\n"
        "        strictestRouting: strictest,\n"
        "        attachmentCount: attachResults.length,\n"
        "        customerName: customer,\n"
        "        inspectionType: itype,\n"
        "      },\n"
        "      requestPayload: {\n"
        "        strictest_routing: strictest,\n"
        "        attachment_count: attachResults.length,\n"
        "        customer_name: customer,\n"
        "        inspection_type: itype,\n"
        "        classifications: classifications.map(c => ({\n"
        "          filename: c.filename,\n"
        "          classification: c.classification,\n"
        "          routing: c.llm_routing,\n"
        "          type_code: c.typeCode,\n"
        "          drawing_number: c.drawing_number,\n"
        "        })),\n"
        "      },"
    )
    if old_block in code:
        code = code.replace(old_block, new_block)
        node["parameters"]["jsCode"] = code
        print(f"  015: added requestPayload to assemble step-update")
    else:
        print(f"  015: target block not found — skipping (code may have changed)")


def patch_node_018(node):
    """Add requestPayload to comply_classify step-update."""
    code = node["parameters"].get("jsCode", "")

    if "'comply_classify'" in code and "requestPayload:" in code:
        print(f"  018: comply_classify already has requestPayload — skipping")
        return

    # Add requestPayload to comply_classify step-update
    old_comply = (
        "      stepKey: 'comply_classify',\n"
        "      status: 'success',\n"
        "      log: _clsLog,\n"
        "      detail: {"
    )
    new_comply = (
        "      stepKey: 'comply_classify',\n"
        "      status: 'success',\n"
        "      log: _clsLog,\n"
        "      requestPayload: { filename: _complyResult.filename, intake_id: _intakeId },\n"
        "      detail: {"
    )
    if old_comply in code:
        code = code.replace(old_comply, new_comply)
        node["parameters"]["jsCode"] = code
        print(f"  018: added requestPayload to comply_classify step-update")
    else:
        print(f"  018: target block not found — skipping (code may have changed)")


def patch_nodes(nodes):
    for node in nodes:
        nid = node.get("id")
        if nid == NODE_IDS["000004"]:
            print(f"Patching node 000004: {node['name']}")
            patch_node_004(node)
        elif nid == NODE_IDS["000012"]:
            print(f"Patching node 000012: {node['name']}")
            patch_node_012(node)
        elif nid == NODE_IDS["000015"]:
            print(f"Patching node 000015: {node['name']}")
            patch_node_015(node)
        elif nid == NODE_IDS["000018"]:
            print(f"Patching node 000018: {node['name']}")
            patch_node_018(node)


print("Patching top-level nodes[]...")
patch_nodes(wf.get("nodes", []))

# pinData also contains nodes (may be null)
if wf.get("pinData") and isinstance(wf["pinData"], dict):
    pin_nodes = wf["pinData"].get("nodes")
    if isinstance(pin_nodes, list):
        print("\nPatching pinData nodes[]...")
        patch_nodes(pin_nodes)

with open(WF5_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("\nDone. WF-5 payload patch applied.")
