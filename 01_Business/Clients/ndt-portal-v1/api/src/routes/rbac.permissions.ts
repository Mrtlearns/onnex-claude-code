import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'RBAC_VIEW',  module: 'rbac', label: 'View RBAC',   description: 'View roles and user assignments',                    category: 'view' },
  { code: 'RBAC_ADMIN', module: 'rbac', label: 'Manage RBAC', description: 'Create/edit roles, assign users, manage permissions', category: 'admin' },
];
