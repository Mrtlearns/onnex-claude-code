import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'SF_ANALYSIS_VIEW', module: 'sf-analysis', label: 'View SF Analysis', description: 'View Salesforce analysis dashboards',  category: 'view' },
  { code: 'SF_ANALYSIS_CHAT', module: 'sf-analysis', label: 'SF Analysis Chat', description: 'Use AI chat for Salesforce analysis',  category: 'edit' },
];
