const AIOS_API_URL = process.env.AIOS_API_URL ?? 'http://aios-api:3001';
const PAPERLESS_AI_API_TOKEN = process.env.PAPERLESS_AI_API_TOKEN ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

// Activity 1: Fetch document content from Paperless via aios-api internal proxy
export async function fetchDocumentContent(documentId: number): Promise<string> {
  const resp = await fetch(`${AIOS_API_URL}/internal/documents/${documentId}/content`);
  if (!resp.ok) throw new Error(`Fetch document failed: ${resp.status}`);
  return resp.text();
}

// Activity 2: Generate embedding via OpenAI text-embedding-3-small
export async function generateEmbedding(content: string): Promise<number[]> {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: content.trim().slice(0, 8000) }),
  });
  if (!resp.ok) throw new Error(`OpenAI embedding failed: ${resp.status}`);
  const data = await resp.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// Activity 3: Write memory entry via aios-api internal route (no auth)
export async function writeMemoryEntry(args: {
  content: string;
  embedding: number[];
  namespace: string;
  tenantId: string;
}): Promise<string> {
  const resp = await fetch(`${AIOS_API_URL}/internal/memory/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!resp.ok) throw new Error(`Memory write failed: ${resp.status}`);
  const data = await resp.json() as { id: string };
  return data.id;
}

// Activity 4: Patch document record with memory_entry_id link
export async function patchDocumentRecord(args: {
  documentId: number;
  memoryEntryId: string;
}): Promise<void> {
  const resp = await fetch(`${AIOS_API_URL}/internal/documents/${args.documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory_entry_id: args.memoryEntryId }),
  });
  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Document patch failed: ${resp.status}`);
  }
  // 404 is OK — document may not be in the in-memory store
}

// ── Paperless Sync Activities ──────────────────────────────────────────────

const PAPERLESS_URL_SYNC = process.env.PAPERLESS_URL ?? 'http://paperless-web:8000';
const PAPERLESS_TOKEN_SYNC = process.env.PAPERLESS_AI_API_TOKEN ?? '';

interface PaperlessDoc {
  id: number;
  title: string;
  original_file_name: string;
  tags: number[];
  correspondent: number | null;
  modified: string;
}

export async function fetchPaperlessDocsSince(since: string): Promise<PaperlessDoc[]> {
  const url = `${PAPERLESS_URL_SYNC}/api/documents/?modified__gt=${encodeURIComponent(since)}&ordering=modified&page_size=100`;
  const resp = await fetch(url, {
    headers: { Authorization: `Token ${PAPERLESS_TOKEN_SYNC}` },
  });
  if (!resp.ok) throw new Error(`Paperless API error: ${resp.status}`);
  const data = await resp.json() as { results: PaperlessDoc[] };
  return data.results;
}

export async function getSyncCursor(): Promise<string> {
  const resp = await fetch(`${AIOS_API_URL}/internal/sync-cursor/paperless`);
  if (!resp.ok) return '1970-01-01T00:00:00Z';
  const data = await resp.json() as { last_synced: string };
  return data.last_synced;
}

export async function upsertDocumentFromPaperless(doc: PaperlessDoc, tenantId: string): Promise<{ id: string; is_new: boolean }> {
  const resp = await fetch(`${AIOS_API_URL}/internal/webhooks/paperless/document-consumed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: doc.id, tenant_id: tenantId }),
  });
  if (!resp.ok) throw new Error(`Upsert failed for paperless_id=${doc.id}: ${resp.status}`);
  const data = await resp.json() as { id: string; paperless_id: number; is_new?: boolean };
  return { id: data.id, is_new: data.is_new ?? false };
}

export async function advanceSyncCursor(timestamp: string): Promise<void> {
  await fetch(`${AIOS_API_URL}/internal/sync-cursor/paperless`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ last_synced: timestamp }),
  });
}
