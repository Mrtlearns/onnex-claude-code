import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function runDocIngestionWorker() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'temporal:7233',
  });
  try {
    const worker = await Worker.create({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE ?? 'aios',
      taskQueue: 'document-ingestion',
      workflowsPath: require.resolve('./workflows/documentIngestion'),
      activities,
    });
    console.log('aios-worker registered on document-ingestion task queue');
    await worker.run();
  } finally {
    await connection.close();
  }
}

async function runSyncWorker() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'temporal:7233',
  });
  try {
    const worker = await Worker.create({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE ?? 'aios',
      taskQueue: 'paperless-sync',
      workflowsPath: require.resolve('./workflows/paperlessSync'),
      activities,
    });
    console.log('aios-worker registered on paperless-sync task queue');
    await worker.run();
  } finally {
    await connection.close();
  }
}

async function run() {
  await Promise.all([runDocIngestionWorker(), runSyncWorker()]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
