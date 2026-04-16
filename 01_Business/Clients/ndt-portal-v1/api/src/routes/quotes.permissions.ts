import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'QUOTE_VIEW',   module: 'quotes', label: 'View Quotes',   description: 'View quote history and status',     category: 'view' },
  { code: 'QUOTE_CREATE', module: 'quotes', label: 'Create Quotes', description: 'Create new quotes',                 category: 'edit' },
  { code: 'QUOTE_EDIT',   module: 'quotes', label: 'Edit Quotes',   description: 'Edit and update quote status',      category: 'edit' },
  { code: 'QUOTE_EXPORT', module: 'quotes', label: 'Export Quotes',  description: 'Export quotes to PDF or CSV',      category: 'export' },
];
