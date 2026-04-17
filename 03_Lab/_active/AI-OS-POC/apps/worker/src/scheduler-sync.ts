import { Connection, Client, ScheduleOverlapPolicy } from '@temporalio/client';

async function createPaperlessSyncSchedule() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'temporal:7233',
  });
  const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE ?? 'aios' });

  try {
    await client.schedule.create({
      scheduleId: 'paperless-sync-cron',
      spec: { intervals: [{ every: '1m' }] },
      action: {
        type: 'startWorkflow',
        workflowType: 'paperlessSyncWorkflow',
        taskQueue: 'paperless-sync',
        workflowId: 'paperless-sync',
        args: [{ tenantId: process.env.DEFAULT_TENANT_ID ?? 'system' }],
      },
      policies: {
        overlap: ScheduleOverlapPolicy.SKIP,
        catchupWindow: '1 minute',
      },
    });
    console.log('paperless-sync-cron schedule created');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('paperless-sync-cron schedule already exists — skipping');
    } else {
      throw e;
    }
  } finally {
    await connection.close();
  }
}

createPaperlessSyncSchedule().catch((err) => { console.error(err); process.exit(1); });
