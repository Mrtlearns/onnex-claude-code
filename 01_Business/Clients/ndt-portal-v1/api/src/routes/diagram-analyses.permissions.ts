import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'QUOTE_ANALYSIS_VIEW', module: 'quote-analyses', label: 'View Quote Analyses', description: 'View LLM analysis responses for all quote types', category: 'view' },
];
