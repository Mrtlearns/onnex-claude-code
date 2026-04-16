import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'WORKSHOP_VIEW',          module: 'workshop', label: 'View Workshop',      description: 'See workshop dashboard and job queue',      category: 'view' },
  { code: 'WORKSHOP_SCHEDULE_EDIT', module: 'workshop', label: 'Edit Schedules',     description: 'Assign and move jobs on machines',           category: 'edit' },
  { code: 'WORKSHOP_SETTINGS',      module: 'workshop', label: 'Workshop Settings',  description: 'Configure machines and offline windows',     category: 'admin' },
  { code: 'WORKSHOP_SIMULATION',    module: 'workshop', label: 'Run Simulations',    description: 'Access capacity simulation tool',            category: 'view' },
];
