/**
 * Pipeline Tester routes — dev-only tool for testing individual pipeline steps
 * No auth required — internal/developer use only.
 *
 * Mounted at /pipeline-tester
 *
 * POST /pipeline-tester/run-step  — execute a single pipeline step
 * GET  /pipeline-tester/steps     — list step definitions with dependency metadata
 */

import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

const SANITIZE_URL = process.env.SANITIZE_URL ?? 'http://sanitize:8011'
const COMPLY_URL   = process.env.COMPLY_URL   ?? 'http://comply:8010'
const GATEWAY_URL  = process.env.GATEWAY_URL  ?? 'http://gateway:3000'

interface RunStepBody {
  stepKey:           string
  emailText?:        string
  emailFrom?:        string
  emailSubject?:     string
  attachmentBase64?: string
  attachmentName?:   string
  attachmentMime?:   string
  previousOutput?:   Record<string, unknown>
}

async function dispatchStep(body: RunStepBody): Promise<Record<string, unknown>> {
  const {
    stepKey,
    emailText,
    emailFrom,
    emailSubject,
    attachmentBase64,
    attachmentName,
    previousOutput,
  } = body

  switch (stepKey) {
    case 'intake': {
      return {
        from:        emailFrom,
        subject:     emailSubject,
        bodyLength:  emailText?.length,
        wordCount:   emailText?.split(' ').length,
      }
    }

    case 'email_sanitize': {
      try {
        const res = await fetch(`${SANITIZE_URL}/sanitize`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text: emailText, routing: 'CLOUD_OK', intake_id: 'tester' }),
        })
        return await res.json() as Record<string, unknown>
      } catch {
        return { error: 'Sanitize service unavailable', fallback: emailText }
      }
    }

    case 'email_llm': {
      const prompt = (previousOutput?.sanitized_text as string | undefined) ?? emailText ?? ''
      try {
        const res = await fetch(`${GATEWAY_URL}/analyze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            intake_id:     'tester',
            prompt,
            system_prompt: 'You are an NDT quote analyst. Extract structured quote parameters from this email. Return JSON with: customerName (string), inspectionType (one of: UT, RT, MT, PT, ET, VT), partNumber (string), specification (string), notes (string), estimatedItems (array of objects with geometryType, quantity, description).',
            classification: 'CLEAN',
            llm_routing:   'CLOUD_OK',
          }),
        })
        return await res.json() as Record<string, unknown>
      } catch {
        return { error: 'Gateway unavailable' }
      }
    }

    case 'comply_classify': {
      const payload: Record<string, unknown> = {
        text:       (previousOutput?.sanitized_text as string | undefined) || emailText || '',
        intake_id:  'tester',
      }
      if (attachmentBase64) {
        payload.attachment_base64 = attachmentBase64
        payload.filename          = attachmentName
      }
      try {
        const res = await fetch(`${COMPLY_URL}/classify`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        return await res.json() as Record<string, unknown>
      } catch {
        return {
          classification: 'UNKNOWN',
          risk_score:     0,
          routing:        'CLOUD_OK',
          error:          'Comply service unavailable - using safe default',
        }
      }
    }

    case 'compliance_gate': {
      return {
        allowed:  true,
        routing:  (previousOutput?.routing as string | undefined) ?? 'CLOUD_OK',
        reason:   'Routing decision based on comply_classify result',
      }
    }

    case 'sanitize_pii': {
      const text = (previousOutput?.sanitized_text as string | undefined)
        ?? attachmentBase64
        ?? emailText
        ?? ''
      try {
        const res = await fetch(`${SANITIZE_URL}/sanitize`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            text,
            routing:   (previousOutput?.routing as string | undefined) ?? 'CLOUD_OK',
            intake_id: 'tester',
          }),
        })
        return await res.json() as Record<string, unknown>
      } catch {
        return { error: 'Sanitize service unavailable' }
      }
    }

    case 'type_detection': {
      const text    = (emailText + ' ' + (attachmentName ?? '')).toLowerCase()
      const types: string[] = []
      if (/ultrasonic|ut[^a-z]/.test(text))  types.push('UT')
      if (/radiograph|x-ray|rt[^a-z]/.test(text)) types.push('RT')
      if (/magnetic|mt[^a-z]/.test(text))    types.push('MT')
      if (/penetrant|pt[^a-z]/.test(text))   types.push('PT')
      if (/eddy|et[^a-z]/.test(text))        types.push('ET')
      if (/visual|vt[^a-z]/.test(text))      types.push('VT')
      const detected = types.length > 0 ? types[0] : 'UT'
      return {
        types:       types.length > 0 ? types : ['UT'],
        primaryType: detected,
        confidence:  types.length > 0 ? 'keyword_match' : 'default_fallback',
      }
    }

    case 'preprocessor': {
      const inspType = (previousOutput?.primaryType as string | undefined)
        ?? (previousOutput?.types as string[] | undefined)?.[0]
        ?? 'UT'
      const types = await query<Record<string, unknown>>(
        'SELECT * FROM app.inspection_types WHERE code=$1 AND is_active=true',
        [inspType],
      )
      if (types.length === 0) {
        return { stepsRun: 0, stepsFound: 0, message: `No inspection type found for code: ${inspType}` }
      }
      const steps = await query<Record<string, unknown>>(
        'SELECT * FROM app.inspection_steps WHERE inspection_type_id=$1 AND is_active=true ORDER BY sort_order',
        [types[0].id],
      )
      return {
        stepsRun:       steps.length,
        stepsFound:     steps.length,
        inspectionType: inspType,
        steps:          steps.map(s => ({
          name:        s.name,
          action_type: s.action_type,
          sort_order:  s.sort_order,
        })),
      }
    }

    case 'llm_analysis': {
      const prompt = (previousOutput?.sanitized_text as string | undefined) ?? emailText ?? ''
      try {
        const res = await fetch(`${GATEWAY_URL}/analyze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            intake_id:     'tester',
            prompt,
            system_prompt: 'You are an NDT inspection analyst specializing in ultrasonic testing. Extract inspection parameters: material type, dimensions (thickness, width, length, diameter), quantity, specification/standard, surface condition, and any special requirements. Return structured JSON.',
            classification: 'CLEAN',
            llm_routing:   'CLOUD_OK',
          }),
        })
        return await res.json() as Record<string, unknown>
      } catch {
        return { error: 'Gateway unavailable' }
      }
    }

    case 'assemble': {
      return {
        merged:      true,
        routing:     (previousOutput?.routing as string | undefined) ?? 'CLOUD_OK',
        summary:     'Email and attachment results assembled',
        quoteParams: previousOutput,
        timestamp:   new Date().toISOString(),
      }
    }

    case 'quote_created': {
      const params = previousOutput?.quoteParams
      if (!params) {
        return { error: 'No quoteParams in previousOutput — run assemble step first' }
      }
      const port = process.env.PORT ?? 3100
      try {
        const res = await fetch(`http://localhost:${port}/quote`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(params),
        })
        return await res.json() as Record<string, unknown>
      } catch (err) {
        return { error: `Quote endpoint unavailable: ${String(err)}` }
      }
    }

    default:
      return { error: `Unknown stepKey: ${stepKey}` }
  }
}

// ── POST /pipeline-tester/run-step ────────────────────────────────────────────

router.post('/run-step', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as RunStepBody
  if (!body.stepKey) {
    res.status(400).json({ error: 'stepKey is required' })
    return
  }

  const start = Date.now()
  try {
    const output = await dispatchStep(body)
    res.json({ stepKey: body.stepKey, output, durationMs: Date.now() - start })
  } catch (err) {
    res.json({
      stepKey:    body.stepKey,
      output:     {},
      durationMs: Date.now() - start,
      error:      String(err),
    })
  }
})

// ── GET /pipeline-tester/steps ────────────────────────────────────────────────

const STEPS = [
  { key: 'intake',          label: 'Message Received',          inputFields: ['emailText', 'emailFrom', 'emailSubject'] },
  { key: 'email_sanitize',  label: 'Email Sanitization',        inputFields: ['emailText'],                              dependsOn: 'intake' },
  { key: 'email_llm',       label: 'Email LLM Analysis',        inputFields: ['emailText'],                              dependsOn: 'email_sanitize', usePreviousField: 'sanitized_text' },
  { key: 'comply_classify', label: 'Compliance Classification', inputFields: ['emailText', 'attachmentBase64', 'attachmentName'], dependsOn: null },
  { key: 'compliance_gate', label: 'Compliance Gate',           inputFields: [],                                         dependsOn: 'comply_classify', usePreviousField: 'routing' },
  { key: 'sanitize_pii',    label: 'PII Sanitization',          inputFields: ['emailText'],                              dependsOn: 'comply_classify', usePreviousField: 'sanitized_text' },
  { key: 'type_detection',  label: 'Inspection Type Detection', inputFields: ['emailText', 'attachmentName'],            dependsOn: 'intake' },
  { key: 'preprocessor',    label: 'Pre-processor',             inputFields: [],                                         dependsOn: 'type_detection', usePreviousField: 'primaryType' },
  { key: 'llm_analysis',    label: 'LLM Analysis',              inputFields: ['emailText'],                              dependsOn: 'sanitize_pii', usePreviousField: 'sanitized_text' },
  { key: 'assemble',        label: 'Assemble Results',          inputFields: [],                                         dependsOn: 'llm_analysis' },
  { key: 'quote_created',   label: 'Quote Created',             inputFields: [],                                         dependsOn: 'assemble', usePreviousField: 'quoteParams' },
]

router.get('/steps', (_req: Request, res: Response) => res.json(STEPS))

export default router
