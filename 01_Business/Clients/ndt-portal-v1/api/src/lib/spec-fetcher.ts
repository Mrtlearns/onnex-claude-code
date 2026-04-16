/**
 * spec-fetcher.ts
 *
 * Fetches LLM-optimised spec markdown from Nextcloud and extracts the clauses
 * relevant to a given analysis module.  Used by rt-pipeline.ts to optionally
 * inject live spec content into Stage 2 prompts.
 *
 * Design goals:
 *  - Always fail gracefully: if the spec file is missing or Nextcloud is
 *    unreachable, return null so the pipeline continues without spec injection.
 *  - Extract only the key clauses for the module to stay within token budget.
 *  - Cache fetched spec content for the lifetime of the process (specs rarely
 *    change; restart the api container to clear the cache).
 */

import { pool } from '../db';

const NC_URL  = process.env.NEXTCLOUD_URL      ?? 'http://nextcloud-app:80';
const NC_USER = process.env.NEXTCLOUD_USER     ?? 'ncadmin';
const NC_PASS = process.env.NEXTCLOUD_PASSWORD ?? 'ncadmin_dev_2024';
const NC_BASE = `${NC_URL}/remote.php/dav/files/${NC_USER}`;
const BASIC_AUTH = Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64');

// In-process cache keyed by Nextcloud path.  null = confirmed missing/error.
const specCache = new Map<string, string | null>();

// ─── Module → folder_references alias mapping ────────────────────────────────
//
// Each analysis module can map to a spec alias registered in app.folder_references.
// The alias points to the _llm_md/ file produced by tools/pdf_to_markdown/convert.py.
// Add aliases here as more spec files are converted.

const MODULE_SPEC_ALIAS: Record<string, string> = {
  asme_viii_vessel:    'spec_asme_viii_vessel',
  asme_b31_piping:     'spec_asme_b31_piping',
  aws_structural:      'spec_aws_d1_structural',
  casting_radiography: 'spec_astm_e446_castings',
  aerospace_ndt:       'spec_nas410_aerospace',
  api_tank:            'spec_api650_tank',
};

// ─── Key clauses to extract per module ───────────────────────────────────────
//
// Only these clause headings (matched by prefix) are pulled from the full spec.
// Keeps the injected token count to ~2-6K instead of injecting the entire spec.

const MODULE_KEY_CLAUSE_PREFIXES: Record<string, string[]> = {
  asme_viii_vessel: [
    'UW-11', 'UW-51', 'UW-52', 'UW-12',
    'UCS-56', 'UCS-66', 'UCS-68',
    'UG-20', 'UG-84',
    'T-233', 'T-271', 'T-274', 'T-285',
  ],
  asme_b31_piping: [
    '341.3', '341.4', '341.5',
    '304.1', '311.2', '328.2',
    'T-233', 'T-271',
  ],
  aws_structural: [
    '4.8', '4.9', '4.13', '6.12', '6.13',
  ],
  casting_radiography: [
    'E446', 'E186', 'E1030',
  ],
  aerospace_ndt: [
    'NAS 410', 'AC7114',
  ],
  api_tank: [
    '7.3', '7.4', '8.5', 'Annex',
  ],
};

// ─── Nextcloud fetch ─────────────────────────────────────────────────────────

function ncEncodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

async function fetchFromNextcloud(ncPath: string): Promise<string | null> {
  if (specCache.has(ncPath)) return specCache.get(ncPath)!;

  const url = `${NC_BASE}/${ncEncodePath(ncPath)}`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Basic ${BASIC_AUTH}` },
      signal:  AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      if (resp.status !== 404) {
        console.warn(`[spec-fetcher] Nextcloud returned ${resp.status} for: ${ncPath}`);
      }
      specCache.set(ncPath, null);
      return null;
    }
    const content = await resp.text();
    specCache.set(ncPath, content);
    return content;
  } catch (e) {
    console.warn(`[spec-fetcher] Failed to fetch spec from Nextcloud: ${e}`);
    specCache.set(ncPath, null);
    return null;
  }
}

// ─── Folder-references lookup ─────────────────────────────────────────────────

async function resolveSpecPath(alias: string): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ nextcloud_path: string }>(
      `SELECT nextcloud_path FROM app.folder_references
       WHERE alias = $1 AND is_active = TRUE
       LIMIT 1`,
      [alias],
    );
    return rows[0]?.nextcloud_path ?? null;
  } catch (e) {
    console.warn(`[spec-fetcher] DB lookup failed for alias "${alias}": ${e}`);
    return null;
  }
}

// ─── Clause extraction ────────────────────────────────────────────────────────
//
// Splits the LLM MD content into ## clause blocks and returns only those
// whose heading starts with one of the requested prefixes.
//
// Each ## block is self-contained (context + rules + tables + cross-refs),
// so a simple heading-split approach works without any re-joining logic.

function extractClauses(markdownContent: string, prefixes: string[]): string {
  if (!prefixes.length) return markdownContent;

  const lines = markdownContent.split('\n');
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inBlock = false;
  let inYaml = false;

  for (const line of lines) {
    // Skip YAML frontmatter
    if (line.trim() === '---') {
      inYaml = !inYaml;
      continue;
    }
    if (inYaml) continue;

    // Detect ## heading (clause-level in LLM MD)
    if (line.startsWith('## ')) {
      // Save previous block if it matched
      if (inBlock && currentBlock.length) {
        blocks.push(currentBlock.join('\n'));
      }
      const headingText = line.slice(3).trim();
      inBlock = prefixes.some(p => headingText.startsWith(p));
      currentBlock = inBlock ? [line] : [];
    } else if (inBlock) {
      currentBlock.push(line);
    }
  }
  // Flush last block
  if (inBlock && currentBlock.length) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.join('\n\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and return the relevant spec clauses for a given analysis module.
 *
 * Returns null if:
 *  - No alias is configured for the module
 *  - The folder_reference is not found or is_active = false
 *  - The Nextcloud file doesn't exist yet (spec not yet converted)
 *  - Nextcloud is unreachable
 *
 * The caller should treat null as "no spec available" and continue without it.
 */
export async function fetchSpecForModule(analysisModule: string): Promise<string | null> {
  const alias = MODULE_SPEC_ALIAS[analysisModule];
  if (!alias) return null;   // no spec configured for this module

  const ncPath = await resolveSpecPath(alias);
  if (!ncPath) return null;  // alias not registered or inactive in DB

  const content = await fetchFromNextcloud(ncPath);
  if (!content) return null;

  const prefixes = MODULE_KEY_CLAUSE_PREFIXES[analysisModule] ?? [];
  const extracted = extractClauses(content, prefixes);

  if (!extracted.trim()) {
    console.warn(`[spec-fetcher] No matching clauses found in spec for module: ${analysisModule}`);
    return null;
  }

  console.log(
    `[spec-fetcher] Injecting ${extracted.length} chars of spec content for module: ${analysisModule}`,
  );
  return extracted;
}

/** Clear the in-process spec cache (useful for testing). */
export function clearSpecCache(): void {
  specCache.clear();
}
