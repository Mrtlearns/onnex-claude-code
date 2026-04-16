import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'ADMIN_VIEW',  module: 'admin', label: 'View Admin',    description: 'Access admin dashboard',                category: 'admin' },
  { code: 'ADMIN_JOBS',  module: 'admin', label: 'Manage Jobs',   description: 'View and manage background jobs',       category: 'admin' },
];
