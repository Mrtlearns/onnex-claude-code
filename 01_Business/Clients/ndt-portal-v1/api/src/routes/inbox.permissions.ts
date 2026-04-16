import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'INBOX_VIEW',   module: 'inbox', label: 'View Inbox',   description: 'View email quote inbox and threads', category: 'view' },
  { code: 'INBOX_MANAGE', module: 'inbox', label: 'Manage Inbox', description: 'Update email quote status',          category: 'edit' },
];
