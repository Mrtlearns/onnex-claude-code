/**
 * Unit tests for n8n WF-6 / WF-7 Code node logic
 *
 * The Code nodes in n8n are pure JS functions. We extract and test them
 * here in isolation so regressions are caught before deploying to n8n.
 */

import { describe, it, expect } from 'vitest'

// ── WF-6: Resolve Received Label ──────────────────────────────────────────

function resolveReceivedLabel(labels: Array<{ id: string; name: string }>) {
  const receivedLabel = labels.find(l => l.name.toLowerCase() === 'received')
  if (receivedLabel) {
    return { receivedLabelId: receivedLabel.id, needsCreate: false }
  }
  return { receivedLabelId: null, needsCreate: true }
}

// ── WF-6: Set Label ID (merge after create/pass-through) ─────────────────

function setLabelId(item: { id?: string; receivedLabelId?: string | null }) {
  const id = item.id ?? item.receivedLabelId
  return { receivedLabelId: id ?? null }
}

// ── WF-6: Build Gmail Modify Payload ─────────────────────────────────────

function buildGmailModifyPayload(messageId: string, receivedLabelId: string | null) {
  return {
    messageId,
    addLabelIds:    receivedLabelId ? [receivedLabelId] : [],
    removeLabelIds: ['INBOX'],
    markRead:       true,
  }
}

// ── WF-7: Validate & Prepare reply ───────────────────────────────────────

function validateAndPrepareReply(input: {
  to?: string
  subject?: string
  body?: string
  emailQuoteId?: string | null
  checkCode?: string | null
}) {
  const to      = input.to      ?? ''
  const subject = input.subject ?? ''
  const body    = input.body    ?? ''

  if (!to || !subject || !body) {
    throw new Error(
      `Missing required field(s): to=${to || 'MISSING'}, subject=${subject || 'MISSING'}, body=${body ? 'ok' : 'MISSING'}`
    )
  }

  return {
    to,
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    body,
    emailQuoteId: input.emailQuoteId ?? null,
    checkCode:    input.checkCode    ?? null,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('WF-6: resolveReceivedLabel', () => {
  it('finds existing received label (case-insensitive)', () => {
    const labels = [
      { id: 'Label_1', name: 'INBOX' },
      { id: 'Label_42', name: 'received' },
      { id: 'Label_7', name: 'sent' },
    ]
    const result = resolveReceivedLabel(labels)
    expect(result).toEqual({ receivedLabelId: 'Label_42', needsCreate: false })
  })

  it('handles "Received" (mixed case)', () => {
    const labels = [{ id: 'Label_9', name: 'Received' }]
    const result = resolveReceivedLabel(labels)
    expect(result.needsCreate).toBe(false)
    expect(result.receivedLabelId).toBe('Label_9')
  })

  it('flags needsCreate when label absent', () => {
    const labels = [{ id: 'Label_1', name: 'INBOX' }, { id: 'Label_2', name: 'SENT' }]
    const result = resolveReceivedLabel(labels)
    expect(result).toEqual({ receivedLabelId: null, needsCreate: true })
  })

  it('returns needsCreate for empty label list', () => {
    expect(resolveReceivedLabel([])).toEqual({ receivedLabelId: null, needsCreate: true })
  })
})

describe('WF-6: setLabelId', () => {
  it('uses .id (newly created label response)', () => {
    expect(setLabelId({ id: 'Label_new' })).toEqual({ receivedLabelId: 'Label_new' })
  })

  it('uses .receivedLabelId (pass-through path)', () => {
    expect(setLabelId({ receivedLabelId: 'Label_existing' })).toEqual({ receivedLabelId: 'Label_existing' })
  })

  it('prefers .id over .receivedLabelId if both present', () => {
    expect(setLabelId({ id: 'Label_new', receivedLabelId: 'Label_old' })).toEqual({ receivedLabelId: 'Label_new' })
  })

  it('returns null when neither field present', () => {
    expect(setLabelId({})).toEqual({ receivedLabelId: null })
  })
})

describe('WF-6: buildGmailModifyPayload', () => {
  it('adds received label and removes INBOX', () => {
    const result = buildGmailModifyPayload('msg-123', 'Label_42')
    expect(result).toEqual({
      messageId:      'msg-123',
      addLabelIds:    ['Label_42'],
      removeLabelIds: ['INBOX'],
      markRead:       true,
    })
  })

  it('skips addLabelIds if receivedLabelId is null', () => {
    const result = buildGmailModifyPayload('msg-456', null)
    expect(result.addLabelIds).toEqual([])
    expect(result.removeLabelIds).toEqual(['INBOX'])
  })

  it('always sets markRead to true', () => {
    const result = buildGmailModifyPayload('msg-789', null)
    expect(result.markRead).toBe(true)
  })
})

describe('WF-7: validateAndPrepareReply', () => {
  const validInput = {
    to: 'customer@example.com',
    subject: 'RT Inspection Request',
    body: 'Please send the drawing.',
    emailQuoteId: 'eq-uuid-123',
    checkCode: 'DIAGRAM_ATTACHED',
  }

  it('returns prepared reply with Re: prefix added', () => {
    const result = validateAndPrepareReply(validInput)
    expect(result.subject).toBe('Re: RT Inspection Request')
    expect(result.to).toBe('customer@example.com')
    expect(result.body).toBe('Please send the drawing.')
  })

  it('does not double-add Re: prefix if already present', () => {
    const result = validateAndPrepareReply({ ...validInput, subject: 'Re: RT Inspection Request' })
    expect(result.subject).toBe('Re: RT Inspection Request')
  })

  it('preserves emailQuoteId and checkCode', () => {
    const result = validateAndPrepareReply(validInput)
    expect(result.emailQuoteId).toBe('eq-uuid-123')
    expect(result.checkCode).toBe('DIAGRAM_ATTACHED')
  })

  it('defaults null for optional fields when absent', () => {
    const result = validateAndPrepareReply({ to: 'a@b.com', subject: 'Hi', body: 'Text' })
    expect(result.emailQuoteId).toBeNull()
    expect(result.checkCode).toBeNull()
  })

  it('throws when to is missing', () => {
    expect(() =>
      validateAndPrepareReply({ subject: 'Hi', body: 'Text' })
    ).toThrow('MISSING')
  })

  it('throws when subject is missing', () => {
    expect(() =>
      validateAndPrepareReply({ to: 'a@b.com', body: 'Text' })
    ).toThrow('MISSING')
  })

  it('throws when body is missing', () => {
    expect(() =>
      validateAndPrepareReply({ to: 'a@b.com', subject: 'Hi' })
    ).toThrow('MISSING')
  })
})
