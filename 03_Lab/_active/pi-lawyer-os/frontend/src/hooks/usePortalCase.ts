import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../lib/api';
import { getPortalToken } from './usePortalAuth';
import type { Case, Client, Document, Communication, CaseSettlement, CaseCost } from '../types';

// ── Portal-scoped fetch (uses portal JWT, not staff JWT) ─────────────────────

async function portalGet<T>(path: string): Promise<T> {
  const token = getPortalToken();
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Query keys ───────────────────────────────────────────────────────────────

export const portalKeys = {
  case: (caseId: string) => ['portal', 'case', caseId] as const,
  client: (clientId: string) => ['portal', 'client', clientId] as const,
  documents: (caseId: string) => ['portal', 'documents', caseId] as const,
  communications: (leadId: string) => ['portal', 'communications', leadId] as const,
  settlement: (caseId: string) => ['portal', 'settlement', caseId] as const,
  costs: (caseId: string) => ['portal', 'costs', caseId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePortalCase(caseId: string | null) {
  return useQuery<Case>({
    queryKey: portalKeys.case(caseId ?? ''),
    queryFn: () =>
      portalGet<Case[]>(`${API_BASE}/cases?id=eq.${caseId}&limit=1`).then(
        (rows) => rows[0],
      ),
    enabled: !!caseId,
    staleTime: 60 * 1000,
  });
}

export function usePortalClient(clientId: string | null) {
  return useQuery<Client>({
    queryKey: portalKeys.client(clientId ?? ''),
    queryFn: () =>
      portalGet<Client[]>(`${API_BASE}/clients?id=eq.${clientId}&limit=1`).then(
        (rows) => rows[0],
      ),
    enabled: !!clientId,
    staleTime: 60 * 1000,
  });
}

export function usePortalDocuments(caseId: string | null) {
  return useQuery<Document[]>({
    queryKey: portalKeys.documents(caseId ?? ''),
    queryFn: () =>
      portalGet<Document[]>(
        `${API_BASE}/documents?case_id=eq.${caseId}&shared_with_client=eq.true&order=created_at.desc`,
      ),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function usePortalCommunications(leadId: string | null) {
  return useQuery<Communication[]>({
    queryKey: portalKeys.communications(leadId ?? ''),
    queryFn: () =>
      portalGet<Communication[]>(
        `${API_BASE}/communications?lead_id=eq.${leadId}&channel=eq.note&order=created_at.desc`,
      ),
    enabled: !!leadId,
    staleTime: 30 * 1000,
  });
}

export function usePortalSettlement(caseId: string | null) {
  return useQuery<CaseSettlement | null>({
    queryKey: portalKeys.settlement(caseId ?? ''),
    queryFn: () =>
      portalGet<CaseSettlement[]>(`${API_BASE}/case_settlements?case_id=eq.${caseId}&limit=1`).then(
        (rows) => rows[0] ?? null,
      ),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}

export function usePortalCosts(caseId: string | null) {
  return useQuery<CaseCost[]>({
    queryKey: portalKeys.costs(caseId ?? ''),
    queryFn: () =>
      portalGet<CaseCost[]>(`${API_BASE}/case_costs?case_id=eq.${caseId}&order=created_at.desc`),
    enabled: !!caseId,
    staleTime: 30 * 1000,
  });
}
