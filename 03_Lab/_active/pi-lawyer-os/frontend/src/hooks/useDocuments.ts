import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiFetch, API_BASE } from '../lib/api';
import type { Document, DocType, AiAnalysis, MedicalAnalysis } from '../types';
import { getToken } from '../lib/auth';

export const documentKeys = {
  all: ['documents'] as const,
  byCase: (caseId: string) => [...documentKeys.all, 'case', caseId] as const,
};

interface UploadDocumentInput {
  file: File;
  case_id: string;
  doc_type: DocType;
  name?: string;
}

export function useDocuments(caseId: string) {
  return useQuery<Document[]>({
    queryKey: documentKeys.byCase(caseId),
    queryFn: () =>
      apiGet<Document[]>(`${API_BASE}/documents?case_id=eq.${caseId}&order=created_at.desc`),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation<Document, Error, UploadDocumentInput>({
    mutationFn: async ({ file, case_id, doc_type, name }) => {
      const token = getToken();
      const form = new FormData();
      form.append('file', file);
      form.append('case_id', case_id);
      form.append('doc_type', doc_type);
      form.append('name', name ?? file.name);

      const response = await fetch('/files/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? `Upload failed: ${response.status}`);
      }

      return response.json() as Promise<Document>;
    },
    onSuccess: (doc) => {
      if (doc.case_id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.byCase(doc.case_id) });
      }
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; case_id: string }>({
    mutationFn: async ({ id }) => {
      await apiFetch(`${API_BASE}/documents?id=eq.${id}`, { method: 'DELETE' });
    },
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.byCase(case_id) });
    },
  });
}

export function getDocumentDownloadUrl(documentId: string): string {
  return `/files/${documentId}`;
}

// ── Case medical AI analyses (PostgREST embedding) ────────────────────────────

interface DocumentWithAnalysis extends Document {
  ai_analyses: AiAnalysis[];
}

export function useCaseMedicalAnalyses(caseId: string) {
  return useQuery<MedicalAnalysis[]>({
    queryKey: [...documentKeys.byCase(caseId), 'ai'],
    queryFn: async () => {
      const rows = await apiGet<DocumentWithAnalysis[]>(
        `${API_BASE}/documents?case_id=eq.${caseId}&doc_type=eq.medical&select=id,name,ai_analyses(id,status,analysis)`,
      );
      return rows
        .flatMap((d) => d.ai_analyses ?? [])
        .filter((a) => a.status === 'complete')
        .map((a) => a.analysis as MedicalAnalysis);
    },
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}
