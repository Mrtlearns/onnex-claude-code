import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'RT_VIEW',         module: 'rt', label: 'View RT',          description: 'View RT costing and inspection data',              category: 'view' },
  { code: 'RT_QUOTE_CREATE', module: 'rt', label: 'Create RT Quotes', description: 'Create new RT quotes',                             category: 'edit' },
  { code: 'RT_QUOTE_EDIT',   module: 'rt', label: 'Edit RT Quotes',   description: 'Edit existing RT quotes',                          category: 'edit' },
  { code: 'RT_SETTINGS',     module: 'rt', label: 'RT Settings',      description: 'Configure RT machine profiles and settings',       category: 'admin' },
];
