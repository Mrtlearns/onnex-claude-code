import { PermissionDef } from '../lib/permissions/types';

// BOM routes share SF Analysis permissions
export const permissions: PermissionDef[] = [
  { code: 'SF_ANALYSIS_VIEW', module: 'sf-analysis', label: 'View SF Analysis', description: 'View Salesforce analysis dashboards', category: 'view' },
];
