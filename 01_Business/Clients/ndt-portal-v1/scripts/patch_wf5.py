"""
Patch WF-5 to make the Gateway loop through ALL configured LLM steps
instead of using only the first one.

Changes:
1. B: Execute Preprocessor Steps — add allLlmSteps array to output
2. Branch B: Gateway Analyze Attachment — convert httpRequest → Code node that loops all LLM steps
"""
import json, sys, re

WF5_PATH = "/opt/ndt-portal/n8n-workflows/WF-5-pipeline-orchestrator.json"

with open(WF5_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ──────────────────────────────────────────────────────────────────────────────
# 1. Patch B: Execute Preprocessor Steps — add allLlmSteps to return
# ──────────────────────────────────────────────────────────────────────────────
PREPROCESSOR_NEW_CODE = r"""// Run all non-llm inspection steps in sort_order; collect preprocessed data.
// ALL llm steps are forwarded in allLlmSteps so the Gateway node loops them.
const rawSteps = $input.first().json;
const ctx = $('B: Match Type + Resolve ID').first().json;

const steps = (Array.isArray(rawSteps) ? rawSteps : [])
  .filter(s => s.is_active)
  .sort((a, b) => a.sort_order - b.sort_order);

const preprocessorSteps = steps.filter(s => s.action_type !== 'llm');
const llmSteps = steps.filter(s => s.action_type === 'llm');
const llmStep = llmSteps[0];

const preprocessedData = {};

for (const step of preprocessorSteps) {
  if (step.action_type === 'webhook' && step.webhook_url) {
    try {
      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: step.webhook_url,
        headers: { 'Content-Type': 'application/json' },
        body: {
          stepName: step.name,
          typeCode: ctx.typeCode,
          classification: ctx.complyResult.classification,
          filename: ctx.complyResult.filename,
          drawingNumber: ctx.complyResult.drawing_number,
          sanitizedText: ctx.sanitizedText,
          sanitizeJobId: ctx.sanitizeJobId,
        },
      });
      preprocessedData[step.name] = response;
    } catch (err) {
      preprocessedData[step.name] = { skipped: true, error: err.message };
    }
  } else if (step.action_type === 'n8n' && step.n8n_workflow) {
    try {
      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: `http://n8n:5678/webhook/${step.n8n_workflow}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          stepName: step.name,
          typeCode: ctx.typeCode,
          filename: ctx.complyResult.filename,
          sanitizedText: ctx.sanitizedText,
        },
      });
      preprocessedData[step.name] = response;
    } catch (err) {
      preprocessedData[step.name] = { skipped: true, error: err.message };
    }
  } else {
    preprocessedData[step.name] = { skipped: true, reason: `action_type=${step.action_type} not yet wired` };
  }
}

const defaultInstruction = 'You are an NDT technical analyst. Extract structured parameters from the document. Return JSON with: partNumber, material, wallThickness, diameter, weldType, ndeSpec, quantity, drawingNumber, notes.';

const _piid = (ctx.complyResult && ctx.complyResult.intake_id) ? ctx.complyResult.intake_id : $('Extract Intake Data').first().json.intakeId;

const stepsRun = preprocessorSteps.length;
const stepsSkipped = Object.values(preprocessedData).filter(v => v && v.skipped).length;
const stepsOk = stepsRun - stepsSkipped;

try {
  await this.helpers.httpRequest({
    method: 'POST', url: 'http://api:3100/integrations/pipeline/step-update',
    headers: { 'Content-Type': 'application/json' },
    body: {
      intakeId: _piid,
      stepKey: 'sanitize_pii',
      status: 'success',
      log: `Entities tokenized \u00b7 job: ${(ctx.sanitizeJobId||'').slice(0,8)} \u00b7 file: ${ctx.complyResult?.filename||'?'}`,
    },
  });
  await this.helpers.httpRequest({
    method: 'POST', url: 'http://api:3100/integrations/pipeline/step-update',
    headers: { 'Content-Type': 'application/json' },
    body: {
      intakeId: _piid,
      stepKey: 'type_detection',
      status: 'success',
      log: `Detected ${ctx.typeCode || 'UT'} (${ctx.typeLabel || 'Ultrasonic Testing'}) \u00b7 matched: "${ctx.matchedKeyword||'default UT'}"`,
      detail: { typeCode: ctx.typeCode, typeLabel: ctx.typeLabel, matchedKeyword: ctx.matchedKeyword },
    },
  });
  await this.helpers.httpRequest({
    method: 'POST', url: 'http://api:3100/integrations/pipeline/step-update',
    headers: { 'Content-Type': 'application/json' },
    body: {
      intakeId: _piid,
      stepKey: 'preprocessor',
      status: 'success',
      log: `${stepsOk} steps executed \u00b7 ${stepsSkipped} skipped \u00b7 type: ${ctx.typeCode}`,
      detail: { stepsTotal: stepsRun, stepsOk, stepsSkipped, typeCode: ctx.typeCode },
    },
  });
  await this.helpers.httpRequest({
    method: 'POST', url: 'http://api:3100/integrations/pipeline/step-update',
    headers: { 'Content-Type': 'application/json' },
    body: { intakeId: _piid, stepKey: 'llm_analysis', status: 'processing', log: `Starting LLM analysis \u00b7 ${llmSteps.length} step(s) configured` },
  });
} catch (_) {}

return [{
  json: {
    preprocessedData,
    allLlmSteps: llmSteps,
    llmInstruction: llmStep?.instruction || defaultInstruction,
    sanitizedText: ctx.sanitizedText,
    sanitizeJobId: ctx.sanitizeJobId,
    complyResult: ctx.complyResult,
    typeCode: ctx.typeCode,
    typeLabel: ctx.typeLabel,
    matchedKeyword: ctx.matchedKeyword,
    stepProvider: llmStep?.provider || null,
    stepModel: llmStep?.model || null,
    intakeId: _piid,
    defaultInstruction,
  }
}];"""

# ──────────────────────────────────────────────────────────────────────────────
# 2. New Gateway Code node — loops ALL configured LLM steps
# ──────────────────────────────────────────────────────────────────────────────
GATEWAY_NEW_CODE = r"""// Loop through ALL configured LLM steps for this inspection type.
// Each step can override provider/model. Results are merged into one combinedOutput.
const preprocessor = $input.first().json;
const {
  allLlmSteps,
  sanitizedText,
  sanitizeJobId,
  complyResult,
  typeCode,
  intakeId: _piid,
  defaultInstruction,
} = preprocessor;

const GATEWAY_URL = 'http://gateway:8012/analyze';
const API_URL     = 'http://api:3100/integrations/pipeline/step-update';

// Fall back to a single default step if none are configured
const llmSteps = Array.isArray(allLlmSteps) && allLlmSteps.length > 0
  ? allLlmSteps
  : [{ instruction: defaultInstruction, provider: null, model: null, name: 'default', id: 'default' }];

let combinedOutput = {};
let lastResponse   = null;
let totalTokens    = 0;
const stepResults  = [];

for (let i = 0; i < llmSteps.length; i++) {
  const step = llmSteps[i];
  const isLast = i === llmSteps.length - 1;

  // Mark step as processing
  try {
    await this.helpers.httpRequest({
      method: 'POST', url: API_URL,
      headers: { 'Content-Type': 'application/json' },
      body: {
        intakeId: _piid,
        stepKey: 'llm_analysis',
        status: 'processing',
        log: `Step ${i + 1}/${llmSteps.length}: ${step.name || 'LLM'} \u00b7 provider: ${step.provider || 'auto'}`,
      },
    });
  } catch (_) {}

  const gatewayBody = {
    intake_id: _piid,
    sanitize_job_id: sanitizeJobId,
    classification: complyResult.classification,
    llm_routing: complyResult.llm_routing,
    prompt: sanitizedText || '',
    system_prompt: step.instruction || defaultInstruction,
  };
  if (step.provider) gatewayBody.provider = step.provider;
  if (step.model)    gatewayBody.model    = step.model;

  try {
    const res = await this.helpers.httpRequest({
      method: 'POST',
      url: GATEWAY_URL,
      headers: { 'Content-Type': 'application/json' },
      body: gatewayBody,
      timeout: 300000,
    });

    lastResponse = res;
    totalTokens += res.prompt_tokens || 0;

    // Merge structured JSON output (later steps can refine/add fields)
    let parsed = {};
    try {
      parsed = typeof res.response_json === 'string'
        ? JSON.parse(res.response_json)
        : (res.response_json || {});
    } catch (_) {}
    Object.assign(combinedOutput, parsed);

    stepResults.push({
      stepName: step.name,
      provider: res.provider_used,
      model: res.model_used,
      tokens: res.prompt_tokens,
      success: true,
    });
  } catch (err) {
    stepResults.push({
      stepName: step.name,
      success: false,
      error: err.message,
    });
    // Non-fatal: continue to next step
  }
}

// Final status update — success if at least one step succeeded
const anySuccess = stepResults.some(r => r.success);
const statusStr  = anySuccess ? 'success' : 'failed';
const stepSummary = stepResults
  .map(r => r.success ? `${r.stepName}:ok` : `${r.stepName}:err`)
  .join(', ');

try {
  await this.helpers.httpRequest({
    method: 'POST', url: API_URL,
    headers: { 'Content-Type': 'application/json' },
    body: {
      intakeId: _piid,
      stepKey: 'llm_analysis',
      status: statusStr,
      log: `${llmSteps.length} LLM step(s) \u00b7 ${totalTokens} tokens \u00b7 ${stepSummary}`,
      detail: {
        stepsRun: llmSteps.length,
        stepResults,
        provider: lastResponse?.provider_used,
        model: lastResponse?.model_used,
        totalTokens,
      },
      serviceName: 'gateway',
      endpoint: GATEWAY_URL,
      httpStatus: 200,
      requestPayload: { intake_id: _piid, classification: complyResult.classification, llm_routing: complyResult.llm_routing },
      responsePayload: { provider: lastResponse?.provider_used, model: lastResponse?.model_used, tokens: totalTokens },
    },
  });
} catch (_) {}

return [{
  json: {
    response_json: JSON.stringify(combinedOutput),
    provider_used: lastResponse?.provider_used,
    model_used: lastResponse?.model_used,
    prompt_tokens: totalTokens,
  }
}];"""

# ──────────────────────────────────────────────────────────────────────────────
# Apply patches to both top-level nodes[] and pinData nodes[]
# ──────────────────────────────────────────────────────────────────────────────
PREPROCESSOR_ID = "a1b2c3d4-0005-0005-0005-000000000022"
GATEWAY_ID      = "a1b2c3d4-0005-0005-0005-000000000012"

def patch_nodes(nodes):
    for node in nodes:
        if node.get("id") == PREPROCESSOR_ID:
            node["parameters"]["jsCode"] = PREPROCESSOR_NEW_CODE
            print(f"  Patched: {node['name']}")

        if node.get("id") == GATEWAY_ID:
            node["type"] = "n8n-nodes-base.code"
            node["typeVersion"] = 2
            node["parameters"] = {
                "mode": "runOnceForEachItem",
                "jsCode": GATEWAY_NEW_CODE,
            }
            # Remove keys only relevant to httpRequest nodes
            for k in ["webhookId"]:
                node.pop(k, None)
            print(f"  Patched: {node['name']}")

print("Patching top-level nodes[]...")
patch_nodes(wf.get("nodes", []))

# pinData also contains a copy of nodes (may be null)
if wf.get("pinData") and isinstance(wf["pinData"], dict):
    print("Patching pinData nodes[]...")
    pin_nodes = wf["pinData"].get("nodes", [])
    patch_nodes(pin_nodes)
else:
    print("pinData is null/absent — skipping")

with open(WF5_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print("Done. WF-5 patched successfully.")
