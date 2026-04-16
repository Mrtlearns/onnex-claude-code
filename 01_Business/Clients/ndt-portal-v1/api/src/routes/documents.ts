/**
 * Documents API — Nextcloud BFF proxy.
 *
 * Mounted at: /documents
 *
 * GET  /documents          — PROPFIND root listing → raw WebDAV XML
 * GET  /documents/*        — ?download=1   → stream file bytes from Nextcloud
 *                          — ?convert=pdf  → convert via Collabora, return PDF
 *                          — (no param)    → PROPFIND directory listing → WebDAV XML
 * POST /documents/*        — OCS Sharing API → create public read-only link → { url }
 */

import { Router, Request, Response } from 'express';
import { Readable } from 'stream';
import { query } from '../db';
import { requirePermission } from '../middleware/requirePermission';

const router = Router();

const NC_URL      = process.env.NEXTCLOUD_URL      ?? 'http://nextcloud-app:80';
const NC_USER     = process.env.NEXTCLOUD_USER     ?? 'ncadmin';
const NC_PASS     = process.env.NEXTCLOUD_PASSWORD ?? 'ncadmin_dev_2024';
const COLLAB_URL  = process.env.COLLABORA_URL      ?? 'http://collabora:9980';
const NC_PUB_URL  = process.env.NEXTCLOUD_PUBLIC_URL ?? 'http://10.10.110.32:8090';
const NC_BASE     = `${NC_URL}/remote.php/dav/files/${NC_USER}`;
const BASIC_AUTH  = Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64');

// In-process cache of directory paths already confirmed to exist in Nextcloud.
// Avoids redundant MKCOL round-trips on every PUT for batch uploads.
const confirmedDirs = new Set<string>();

// In-process cache: path → lastModified ms. If a PUT arrives for a path we already
// successfully uploaded with the same client-side lastModified, skip the upload.
const uploadedFiles = new Map<string, number>();

function extractPath(req: Request): string {
  return ((req.params as Record<string, string>)[0] ?? '').replace(/^\//, '');
}

// Re-encode a decoded path for use in Nextcloud WebDAV URLs.
// Express decode_param() decodes %20→space etc. in wildcard captures;
// we must re-encode before constructing fetch() URLs.
function ncEncodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

// ─── GET / and GET /* ─────────────────────────────────────────────────────────
async function handleGet(req: Request, res: Response): Promise<void> {
  const resourcePath = extractPath(req);
  const { download, convert } = req.query;

  // Mode: ?convert=pdf — fetch file from Nextcloud, POST to Collabora
  if (convert === 'pdf' && resourcePath) {
    try {
      const ncRes = await fetch(`${NC_BASE}/${ncEncodePath(resourcePath)}`, {
        headers: { Authorization: `Basic ${BASIC_AUTH}` },
      });
      if (!ncRes.ok) { res.status(ncRes.status).send('Not found'); return; }

      const fileBuffer = await ncRes.arrayBuffer();
      const fileName = resourcePath.split('/').pop() ?? 'file';

      const formData = new FormData();
      formData.append('data', new Blob([fileBuffer]), fileName);

      const convertRes = await fetch(`${COLLAB_URL}/cool/convert-to/pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!convertRes.ok || !convertRes.body) {
        // Fall back to raw download
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
        res.end(Buffer.from(fileBuffer));
        return;
      }

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${fileName}.pdf"`);
      Readable.fromWeb(convertRes.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } catch {
      res.status(503).send('Conversion unavailable');
    }
    return;
  }

  // Mode: ?download=1 — stream raw file
  if (download === '1' && resourcePath) {
    try {
      const ncRes = await fetch(`${NC_BASE}/${ncEncodePath(resourcePath)}`, {
        headers: { Authorization: `Basic ${BASIC_AUTH}` },
      });
      if (!ncRes.ok || !ncRes.body) { res.status(ncRes.status).send('Not found'); return; }

      const fileName = resourcePath.split('/').pop() ?? 'file';
      res.set('Content-Type', ncRes.headers.get('Content-Type') ?? 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${fileName}"`);
      Readable.fromWeb(ncRes.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } catch {
      res.status(503).send('Nextcloud unavailable');
    }
    return;
  }

  // Default: PROPFIND directory listing
  try {
    const url = resourcePath ? `${NC_BASE}/${ncEncodePath(resourcePath)}` : `${NC_BASE}/`;
    const ncRes = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        Depth: '1',
        'Content-Type': 'application/xml',
      },
    });

    const xml = await ncRes.text();
    res.set('Content-Type', ncRes.headers.get('Content-Type') ?? 'application/xml');
    res.status(ncRes.status).send(xml);
  } catch {
    res.status(503).json({ error: 'Nextcloud unavailable' });
  }
}

// ─── POST /* — create public share link ───────────────────────────────────────
async function handlePost(req: Request, res: Response): Promise<void> {
  const resourcePath = extractPath(req);
  const filePath = '/' + resourcePath;

  try {
    const ncRes = await fetch(`${NC_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${BASIC_AUTH}`,
        'OCS-APIREQUEST': 'true',
      },
      body: new URLSearchParams({ path: filePath, shareType: '3', permissions: '1' }),
    });

    const xml = await ncRes.text();
    const token = xml.match(/<token>(.*?)<\/token>/)?.[1];
    if (!token) { res.status(500).json({ error: 'Share creation failed' }); return; }

    res.json({ url: `${NC_PUB_URL}/s/${token}` });
  } catch {
    res.status(503).json({ error: 'Nextcloud unavailable' });
  }
}

// ─── Ensure all parent path segments exist in Nextcloud via MKCOL ─────────────
async function ensureParentDirs(resourcePath: string): Promise<void> {
  const segments = resourcePath.split('/');
  // Walk every segment except the last (the file itself)
  for (let i = 1; i < segments.length; i++) {
    const dirPath = segments.slice(0, i).join('/');
    if (confirmedDirs.has(dirPath)) continue;          // skip if already confirmed this process
    const ncUrl = `${NC_BASE}/${ncEncodePath(dirPath)}`;
    const ncRes = await fetch(ncUrl, {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${BASIC_AUTH}` },
    });
    // 201 = created, 405 = already exists — both are fine
    if (ncRes.ok || ncRes.status === 405) {
      confirmedDirs.add(dirPath);                       // cache on success or already-exists
      console.log(`[MKDIR] auto ensured "${dirPath}" status=${ncRes.status}`);
    } else {
      const body = await ncRes.text();
      console.error(`[MKDIR] auto-mkdir failed for "${dirPath}" status=${ncRes.status}: ${body}`);
    }
  }
}

// ─── PUT /* — file upload via WebDAV PUT ──────────────────────────────────────
async function handlePut(req: Request, res: Response): Promise<void> {
  const resourcePath = extractPath(req);
  if (!resourcePath) { res.status(400).json({ error: 'Path required' }); return; }

  try {
    const lmHeader = req.headers['x-file-last-modified'];
    const lastModifiedMs = lmHeader ? parseInt(lmHeader as string, 10) : NaN;

    // Skip if already uploaded with identical timestamp
    if (!isNaN(lastModifiedMs) && uploadedFiles.get(resourcePath) === lastModifiedMs) {
      console.log(`[PUT] skipped (cached) path="${resourcePath}" lm=${lastModifiedMs}`);
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    await ensureParentDirs(resourcePath);
    const ncUrl = `${NC_BASE}/${ncEncodePath(resourcePath)}`;
    console.log(`[PUT] path="${resourcePath}" url="${ncUrl}" content-type="${req.headers['content-type']}" content-length="${req.headers['content-length']}"`);
    const ncRes = await fetch(ncUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        'Content-Type': req.headers['content-type'] ?? 'application/octet-stream',
        ...(req.headers['content-length'] ? { 'Content-Length': req.headers['content-length'] } : {}),
      },
      body: Readable.toWeb(req) as ReadableStream,
      duplex: 'half' as any,
    });
    console.log(`[PUT] status=${ncRes.status} ok=${ncRes.ok} path="${resourcePath}"`);
    if (!ncRes.ok) {
      const body = await ncRes.text();
      console.error(`[PUT] NC error body: ${body}`);
    } else if (!isNaN(lastModifiedMs)) {
      uploadedFiles.set(resourcePath, lastModifiedMs);   // cache on success
    }
    res.status(ncRes.ok ? 200 : ncRes.status).json({ ok: ncRes.ok });
  } catch (err) {
    console.error(`[PUT] exception path="${resourcePath}"`, err);
    res.status(503).json({ error: 'Upload failed' });
  }
}

// ─── POST /mkdir/* — create folder via WebDAV MKCOL ───────────────────────────
async function handleMkdir(req: Request, res: Response): Promise<void> {
  const resourcePath = ((req.params as Record<string, string>)[0] ?? '').replace(/^\//, '');
  if (!resourcePath) { res.status(400).json({ error: 'Path required' }); return; }

  try {
    const ncUrl = `${NC_BASE}/${ncEncodePath(resourcePath)}`;
    console.log(`[MKDIR] path="${resourcePath}" url="${ncUrl}"`);
    const ncRes = await fetch(ncUrl, {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${BASIC_AUTH}` },
    });
    console.log(`[MKDIR] status=${ncRes.status} ok=${ncRes.ok} path="${resourcePath}"`);
    // 405 = collection already exists — treat as success
    const ok = ncRes.ok || ncRes.status === 405;
    if (!ncRes.ok && ncRes.status !== 405) {
      const body = await ncRes.text();
      console.error(`[MKDIR] NC error body: ${body}`);
    }
    res.status(ok ? 200 : ncRes.status).json({ ok });
  } catch (err) {
    console.error(`[MKDIR] exception path="${resourcePath}"`, err);
    res.status(503).json({ error: 'Mkdir failed' });
  }
}

// ─── DELETE /* — soft delete (move to _deleted/) or hard delete ───────────────
async function handleDelete(req: Request, res: Response): Promise<void> {
  const resourcePath = extractPath(req);
  if (!resourcePath) { res.status(400).json({ error: 'Path required' }); return; }

  try {
    if (resourcePath.startsWith('_deleted/') || resourcePath === '_deleted') {
      // Hard delete — permanent removal from Nextcloud
      const ncRes = await fetch(`${NC_BASE}/${ncEncodePath(resourcePath)}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${BASIC_AUTH}` },
      });
      await query(
        `INSERT INTO app.document_audit_log (action, path) VALUES ($1, $2)`,
        ['delete_hard', resourcePath],
      );
      res.status(ncRes.ok ? 200 : ncRes.status).json({ ok: ncRes.ok });
    } else {
      // Soft delete — move to _deleted/
      // Ensure _deleted/ exists (ignore 405 = already exists)
      await fetch(`${NC_BASE}/_deleted`, {
        method: 'MKCOL',
        headers: { Authorization: `Basic ${BASIC_AUTH}` },
      });
      const basename = resourcePath.split('/').pop()!;
      const ncRes = await fetch(`${NC_BASE}/${ncEncodePath(resourcePath)}`, {
        method: 'MOVE',
        headers: {
          Authorization: `Basic ${BASIC_AUTH}`,
          Destination: `${NC_BASE}/_deleted/${encodeURIComponent(basename)}`,
          Overwrite: 'T',
        },
      });
      await query(
        `INSERT INTO app.document_audit_log (action, path) VALUES ($1, $2)`,
        ['delete_soft', resourcePath],
      );
      res.status(ncRes.ok ? 200 : ncRes.status).json({ ok: ncRes.ok });
    }
  } catch (err) {
    console.error('[handleDelete]', err);
    res.status(500).json({ error: 'Delete failed' });
  }
}

// ─── POST /maintenance — purge _deleted/ items older than 30 days ─────────────
async function handleMaintenance(_req: Request, res: Response): Promise<void> {
  const jobStart = Date.now();
  let jobRunId: number | null = null;

  try {
    const runRows = await query<{ id: number }>(
      `INSERT INTO app.job_runs (job_name, status) VALUES ('doc_purge', 'running') RETURNING id`,
    );
    jobRunId = runRows[0]?.id ?? null;

    const propfindRes = await fetch(`${NC_BASE}/_deleted/`, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        Depth: '1',
        'Content-Type': 'application/xml',
      },
    });

    if (!propfindRes.ok) {
      const summary = 'Nothing to purge (_deleted folder absent)';
      if (jobRunId !== null) {
        await query(
          `UPDATE app.job_runs SET finished_at=now(), duration_ms=$1, status='success', summary=$2 WHERE id=$3`,
          [Date.now() - jobStart, summary, jobRunId],
        );
      }
      res.json({ purged: 0, errors: [] });
      return;
    }

    const xml = await propfindRes.text();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const purged: string[] = [];
    const errors: string[] = [];

    // Split XML by response blocks to pair hrefs with lastModified dates
    const responseBlocks = xml.split(/<[Dd]:response>/);
    for (const block of responseBlocks.slice(1)) {
      const hrefMatch = block.match(/<[Dd]:href>([^<]+)<\/[Dd]:href>/);
      const lmMatch   = block.match(/<[Dd]:getlastmodified>([^<]+)<\/[Dd]:getlastmodified>/);
      if (!hrefMatch) continue;

      const href = decodeURIComponent(hrefMatch[1].trim());
      const pathMatch = href.match(/\/remote\.php\/dav\/files\/[^/]+\/(.+)/);
      if (!pathMatch) continue;
      const filePath = pathMatch[1].replace(/\/$/, '');
      if (filePath === '_deleted') continue;

      if (!lmMatch) continue;
      const lastMod = new Date(lmMatch[1]);
      if (isNaN(lastMod.getTime()) || lastMod >= cutoff) continue;

      try {
        const delRes = await fetch(`${NC_BASE}/${filePath}`, {
          method: 'DELETE',
          headers: { Authorization: `Basic ${BASIC_AUTH}` },
        });
        if (delRes.ok) {
          purged.push(filePath);
          await query(
            `INSERT INTO app.document_audit_log (action, path, actor) VALUES ('purge', $1, 'cron')`,
            [filePath],
          );
        } else {
          errors.push(`${filePath}: HTTP ${delRes.status}`);
        }
      } catch (err) {
        errors.push(`${filePath}: ${String(err)}`);
      }
    }

    const summary = `Purged ${purged.length} items from _deleted/`;
    if (jobRunId !== null) {
      await query(
        `UPDATE app.job_runs SET finished_at=now(), duration_ms=$1, status='success', records_upserted=$2, summary=$3 WHERE id=$4`,
        [Date.now() - jobStart, JSON.stringify({ purged: purged.length }), summary, jobRunId],
      );
    }
    res.json({ purged: purged.length, errors });
  } catch (err) {
    console.error('[handleMaintenance]', err);
    if (jobRunId !== null) {
      await query(
        `UPDATE app.job_runs SET finished_at=now(), duration_ms=$1, status='error', error=$2 WHERE id=$3`,
        [Date.now() - jobStart, String(err), jobRunId],
      ).catch(() => {});
    }
    res.status(500).json({ error: 'Maintenance failed' });
  }
}

router.get('/', requirePermission('DOCUMENT_VIEW'), handleGet);
router.get('/*', requirePermission('DOCUMENT_VIEW'), handleGet);
router.put('/*', requirePermission('DOCUMENT_UPLOAD'), handlePut);
router.post('/mkdir/*', requirePermission('DOCUMENT_UPLOAD'), handleMkdir);
router.post('/maintenance', requirePermission('DOCUMENT_UPLOAD'), handleMaintenance);
router.post('/*', requirePermission('DOCUMENT_UPLOAD'), handlePost);
router.delete('/*', requirePermission('DOCUMENT_DELETE'), handleDelete);

export default router;
