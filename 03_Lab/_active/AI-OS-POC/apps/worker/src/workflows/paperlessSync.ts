import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  fetchPaperlessDocsSince,
  getSyncCursor,
  upsertDocumentFromPaperless,
  advanceSyncCursor,
  generateEmbedding,
  writeMemoryEntry,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '2s',
    maximumInterval: '60s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// tenantId is passed as an argument — never read process.env inside a Temporal workflow
// (workflow sandbox forbids non-deterministic side effects including env reads)
export async function paperlessSyncWorkflow(args: { tenantId: string }): Promise<void> {
  const { tenantId } = args;
  const since = await getSyncCursor();
  const docs = await fetchPaperlessDocsSince(since);

  if (docs.length === 0) return;

  const latestModified = docs[docs.length - 1].modified;

  for (const doc of docs) {
    const { id, is_new } = await upsertDocumentFromPaperless(doc, tenantId);

    if (is_new) {
      try {
        const content = `${doc.title}. File: ${doc.original_file_name}`;
        const embedding = await generateEmbedding(content);
        await writeMemoryEntry({
          content,
          embedding,
          namespace: 'documents',
          tenantId,
        });
      } catch (e) {
        console.warn(`Embedding failed for paperless_id=${doc.id}: ${e}`);
      }
    }
  }

  await advanceSyncCursor(latestModified);
}
