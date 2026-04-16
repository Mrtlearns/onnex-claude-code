import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'UT_RULES_VIEW',   module: 'ut', label: 'View UT Rules',   description: 'View UT rule sets and calculation traces', category: 'view' },
  { code: 'UT_RULES_MANAGE', module: 'ut', label: 'Manage UT Rules', description: 'Create, edit, and version UT rule sets',   category: 'admin' },
  { code: 'UT_SETTINGS',     module: 'ut', label: 'UT Settings',     description: 'Configure UT global settings and rates',   category: 'admin' },
];
