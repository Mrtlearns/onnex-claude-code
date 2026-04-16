import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api';
import type { AiAnalysis, AiClassification } from '../types';

const AI_BASE = '/ai';

export const aiKeys = {
  all: ['ai'] as const,
  analysis: (documentId: string) => [...aiKeys.all, 'analysis', documentId] as const,
};

// ── Fetch stored analysis for a document ─────────────────────────────────────

export function useDocumentAnalysis(documentId: string | undefined) {
  return useQuery<AiAnalysis>({
    queryKey: aiKeys.analysis(documentId ?? ''),
    queryFn: () => apiGet<AiAnalysis>(`${AI_BASE}/analysis/${documentId}`),
    enabled: !!documentId,
    staleTime: 60 * 1000,
    retry: false,
  });
}

// ── Trigger document analysis ─────────────────────────────────────────────────

export function useAnalyzeDocument() {
  const queryClient = useQueryClient();
  return useMutation<AiAnalysis, Error, { document_id: string }>({
    mutationFn: (input) =>
      apiPost<AiAnalysis>(`${AI_BASE}/analyze-document`, input),
    onSuccess: (_, { document_id }) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.analysis(document_id) });
    },
  });
}

// ── Classify document ─────────────────────────────────────────────────────────

interface ClassifyResult {
  document_id: string;
  classification: AiClassification;
  doc_type_updated: string;
}

export function useClassifyDocument() {
  return useMutation<ClassifyResult, Error, { document_id: string }>({
    mutationFn: (input) =>
      apiPost<ClassifyResult>(`${AI_BASE}/classify-document`, input),
  });
}
