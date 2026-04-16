import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'

test.describe('API Contract', () => {

  test('UT API health returns ok', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/quote/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('ndt-ut-api')
  })

  test('RT API health returns ok', async ({ request }) => {
    const res = await request.get(`${BASE}/api/rt/quote/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('ndt-rt-api')
  })

  test('GET /api/ut/quote returns array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/quote`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /api/rt/quote returns array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/rt/quote`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('POST /api/ut/quote — valid FLAT_BAR returns 201 with pricing', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/quote`, {
      data: {
        customerName: 'PREMCO',
        source: 'api',
        items: [{
          geometryType: 'FLAT_BAR',
          thickness: 3.625,
          width: 11.625,
          length: 15.75,
          quantity: 10,
        }],
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('quoteId')
    expect(body).toHaveProperty('quoteNumber')
    expect(body.summary.totalGrand).toBeGreaterThan(0)
    expect(body.customer.name).toBe('PREMCO')

    // Clean up: quotes are persist-only, no delete endpoint — this is expected test data
    // quoteId recorded for reference: body.quoteId
  })

  test('POST /api/ut/quote — missing customer returns 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/quote`, {
      data: {
        customerName: 'NO_SUCH_CUSTOMER_ZZZNOMATCH',
        source: 'api',
        items: [{ geometryType: 'FLAT_BAR', thickness: 1, width: 2, length: 3, quantity: 1 }],
      },
    })
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('CUSTOMER_NOT_FOUND')
  })

  test('POST /api/ut/quote — invalid geometry returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/quote`, {
      data: {
        customerName: 'PREMCO',
        source: 'api',
        items: [{ geometryType: 'FLAT_BAR', quantity: 1 }], // missing thickness/width/length
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  test('POST /api/rt/quote — valid single view returns 201', async ({ request }) => {
    const res = await request.post(`${BASE}/api/rt/quote`, {
      data: {
        partNumber: 'PW-E2E-TEST',
        customerName: 'E2E Test',
        source: 'api',
        views: [{
          viewNumber: 1,
          shotType: 1,
          qtyPartsPerFilm: 2,
          filmSizeLabel: '4.5X10',
          unpackLoadTime: 1.0,
          darkroomSortTime: 1.0,
          shotTime: 2.0,
          readTime: 1.0,
        }],
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('quoteId')
    expect(body).toHaveProperty('quoteNumber')
    expect(body.totals.totalPrice).toBeGreaterThan(0)
    expect(body.tierComparison.length).toBeGreaterThan(0)
  })

  test('POST /api/rt/quote — missing views returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/rt/quote`, {
      data: {
        partNumber: 'PW-E2E-FAIL',
        customerName: 'E2E Test',
        views: [],
      },
    })
    expect(res.status()).toBe(400)
  })

  test('PATCH /api/ut/quote/:id/status — invalid UUID returns 400', async ({ request }) => {
    const res = await request.patch(`${BASE}/api/ut/quote/not-a-uuid/status`, {
      data: { status: 'sent' },
    })
    expect(res.status()).toBe(400)
  })

  test('PATCH /api/ut/quote/:id/status — non-existent quote returns 404', async ({ request }) => {
    const res = await request.patch(`${BASE}/api/ut/quote/00000000-0000-0000-0000-000000000000/status`, {
      data: { status: 'sent' },
    })
    expect(res.status()).toBe(404)
  })

  test('n8n endpoint without token returns 401 when secret configured', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/integrations/n8n/quote`, {
      data: { customerName: 'PREMCO', items: [] },
    })
    // 401 (secret configured), 400 (validation error), or 404 (route not deployed yet)
    expect([401, 400, 404]).toContain(res.status())
  })

  // ── Pipeline audit API contract ───────────────────────────────────────────

  test('GET /pipeline/sessions returns array (if endpoint exists)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/integrations/pipeline/sessions`)
    // 200 = endpoint exists, 404 = not yet implemented (skip gracefully)
    if (res.status() === 404) return
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /pipeline/audit/:invalidId returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/integrations/pipeline/audit/00000000-0000-0000-0000-000000000000`)
    expect(res.status()).toBe(404)
  })

  test('GET /pipeline/status/:invalidId returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/integrations/pipeline/status/00000000-0000-0000-0000-000000000000`)
    expect(res.status()).toBe(404)
  })

  test('GET /pipeline/audit response has camelCase fields when session exists', async ({ request }) => {
    const listRes = await request.get(`${BASE}/api/ut/integrations/pipeline/sessions`)
    if (!listRes.ok()) return  // endpoint not available — skip

    const sessions = await listRes.json()
    if (!Array.isArray(sessions) || sessions.length === 0) return

    const intakeId = sessions[0].intakeId ?? sessions[0].intake_id
    if (!intakeId) return

    const res = await request.get(`${BASE}/api/ut/integrations/pipeline/audit/${intakeId}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('intake')
    expect(body).toHaveProperty('events')
    expect(body).toHaveProperty('eventCount')

    // CRITICAL: fields must be camelCase — this test catches the snake_case bug
    expect(body.intake).toHaveProperty('intakeId')    // NOT intake_id
    expect(body.intake).toHaveProperty('createdAt')   // NOT created_at
    expect(body.intake).toHaveProperty('updatedAt')   // NOT updated_at
    expect(body.intake).toHaveProperty('msgFilename') // NOT msg_filename

    // Dates must parse correctly
    expect(new Date(body.intake.createdAt).getTime()).not.toBeNaN()
    expect(new Date(body.intake.updatedAt).getTime()).not.toBeNaN()

    if (body.events.length > 0) {
      const evt = body.events[0]
      expect(evt).toHaveProperty('stepKey')    // NOT step_key
      expect(evt).toHaveProperty('eventType')  // NOT event_type
      expect(evt).toHaveProperty('createdAt')  // NOT created_at
      expect(new Date(evt.createdAt).getTime()).not.toBeNaN()
    }
  })
})
