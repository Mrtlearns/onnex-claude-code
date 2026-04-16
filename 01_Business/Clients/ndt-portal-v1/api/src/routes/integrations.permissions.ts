import { PermissionDef } from '../lib/permissions/types';

// Integrations routes (Salesforce webhooks, email ingestion) use settings permissions.
// Pipeline-specific permissions cover intake processing.
export const permissions: PermissionDef[] = [
  { code: 'PIPELINE_VIEW',   module: 'pipeline', label: 'View Pipeline',   description: 'View pipeline status and intake sessions',  category: 'view' },
  { code: 'PIPELINE_INTAKE', module: 'pipeline', label: 'Pipeline Intake', description: 'Submit and manage pipeline intake jobs',     category: 'edit' },
];
