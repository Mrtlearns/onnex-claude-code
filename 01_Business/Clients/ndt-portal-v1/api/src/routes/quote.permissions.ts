import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'UT_VIEW',         module: 'ut', label: 'View UT',          description: 'View UT calculator and inspection data',   category: 'view' },
  { code: 'UT_QUOTE_CREATE', module: 'ut', label: 'Create UT Quotes', description: 'Create new UT quotes',                     category: 'edit' },
];
