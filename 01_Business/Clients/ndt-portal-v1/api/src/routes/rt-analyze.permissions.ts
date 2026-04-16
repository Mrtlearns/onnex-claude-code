import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'RT_ANALYZE', module: 'rt', label: 'RT Analysis', description: 'Run RT two-stage LLM analysis', category: 'edit' },
];
