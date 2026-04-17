import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  fetchDocumentContent,
  generateEmbedding,
  writeMemoryEntry,
  patchDocumentRecord,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function documentIngestionWorkflow(args: {
  documentId: number;
  tenantId: string;
  source?: string;
}): Promise<void> {
  if (args.documentId === 0) {
    // Cron trigger with no specific document — skip for POC
    console.log('Cron trigger with documentId=0 — no-op for POC');
    return;
  }
  const content = await fetchDocumentContent(args.documentId);
  const embedding = await generateEmbedding(content);
  const memoryEntryId = await writeMemoryEntry({
    content,
    embedding,
    namespace: 'project',
    tenantId: args.tenantId,
  });
  await patchDocumentRecord({
    documentId: args.documentId,
    memoryEntryId,
  });
}
