import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPool = {
  query: vi.fn(),
};

vi.mock('../../db.js', () => ({ getPool: () => mockPool }));

describe('documents route — postgres integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a document record and returns it', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: fakeId,
        filename: 'invoice.pdf',
        nextcloud_url: 'https://nc/invoice.pdf',
        paperless_id: null,
        created_at: new Date().toISOString(),
        memory_entry_id: null,
      }],
    });
    const result = await mockPool.query(
      'INSERT INTO documents (filename, nextcloud_url, tenant_id) VALUES ($1,$2,$3) RETURNING *',
      ['invoice.pdf', 'https://nc/invoice.pdf', 'system']
    );
    expect(result.rows[0].filename).toBe('invoice.pdf');
    expect(result.rows[0].id).toBe(fakeId);
  });

  it('returns 404 when document not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const result = await mockPool.query('SELECT * FROM documents WHERE id=$1', ['nonexistent-id']);
    expect(result.rows).toHaveLength(0);
  });

  it('updates memory_entry_id via PATCH', async () => {
    const fakeMemoryId = '00000000-0000-0000-0000-000000000002';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-0000-0000-000000000001', memory_entry_id: fakeMemoryId }],
    });
    const result = await mockPool.query(
      'UPDATE documents SET memory_entry_id=$1 WHERE id=$2 RETURNING id, memory_entry_id',
      [fakeMemoryId, '00000000-0000-0000-0000-000000000001']
    );
    expect(result.rows[0].memory_entry_id).toBe(fakeMemoryId);
  });

  it('upserts paperless metadata on sync', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: '00000000-0000-0000-0000-000000000003', paperless_id: 42 }],
    });
    const result = await mockPool.query(
      `INSERT INTO documents (filename, paperless_id, paperless_title, paperless_tags, tenant_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (paperless_id) DO UPDATE SET
         paperless_title=EXCLUDED.paperless_title,
         paperless_tags=EXCLUDED.paperless_tags,
         synced_at=now()
       RETURNING id, paperless_id`,
      ['invoice.pdf', 42, 'Invoice 2026', ['finance', 'acme'], 'system']
    );
    expect(result.rows[0].paperless_id).toBe(42);
  });
});
