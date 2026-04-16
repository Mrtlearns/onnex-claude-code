import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'SETTINGS_VIEW',             module: 'settings', label: 'View Settings',      description: 'View integration settings',                        category: 'view' },
  { code: 'SETTINGS_LLM',              module: 'settings', label: 'LLM Settings',       description: 'Configure LLM provider and API keys',              category: 'admin' },
  { code: 'SETTINGS_INTEGRATIONS',     module: 'settings', label: 'Integration Settings', description: 'Configure Salesforce, email, n8n integrations',  category: 'admin' },
  { code: 'SETTINGS_INSPECTION_TYPES', module: 'settings', label: 'Inspection Types',   description: 'Configure inspection types and steps',             category: 'admin' },
];
