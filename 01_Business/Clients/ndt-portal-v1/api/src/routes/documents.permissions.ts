import { PermissionDef } from '../lib/permissions/types';

export const permissions: PermissionDef[] = [
  { code: 'DOCUMENT_VIEW',   module: 'documents', label: 'View Documents',   description: 'View documents in Nextcloud',     category: 'view' },
  { code: 'DOCUMENT_UPLOAD', module: 'documents', label: 'Upload Documents', description: 'Upload documents to Nextcloud',   category: 'edit' },
  { code: 'DOCUMENT_DELETE', module: 'documents', label: 'Delete Documents', description: 'Delete documents from Nextcloud', category: 'admin' },
];
