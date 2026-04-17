import { Client, Connection } from '@temporalio/client';
import { documentIngestionWorkflow } from './workflows/documentIngestion';

async function run() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'temporal:7233',
  });
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'aios',
  });

  try {
    await client.schedule.create({
      scheduleId: 'document-ingestion-cron',
      action: {
        type: 'startWorkflow',
        workflowType: documentIngestionWorkflow,
        args: [{ documentId: 0, tenantId: 'scheduler', source: 'cron' }],
        taskQueue: 'document-ingestion',
      },
      spec: {
        intervals: [{ every: '1h' }],
      },
    });
    console.log('Schedule registered: document-ingestion-cron (hourly)');
  } catch (err: any) {
    if (err.code === 6) {
      console.log('Schedule already exists — no change needed');
    } else {
      throw err;
    }
  }
  await connection.close();
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
