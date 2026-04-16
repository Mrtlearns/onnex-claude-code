import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { Lead, LeadStatus } from '../types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const leadKeys = {
  all: ['leads'] as const,
  list: (filters?: { status?: LeadStatus }) =>
    [...leadKeys.all, 'list', filters ?? {}] as const,
  detail: (id: string) => [...leadKeys.all, 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CreateLeadInput = Omit<Lead, 'id' | 'firm_id' | 'reminder_count' | 'referred_by_partner_id' | 'last_contact_at' | 'resurrection_sent_at' | 'lead_score' | 'lead_score_reason' | 'is_duplicate' | 'duplicate_of_lead_id' | 'created_at' | 'updated_at'>;

interface UpdateLeadInput {
  id: string;
  data: Partial<Omit<Lead, 'id' | 'firm_id' | 'created_at' | 'updated_at'>>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated lead list for the authenticated firm.
 * PostgREST row-level security scopes results to the JWT's firm_id automatically.
 * Optional `status` filter uses PostgREST eq syntax.
 */
export function useLeads(filters?: { status?: LeadStatus }) {
  return useQuery<Lead[]>({
    queryKey: leadKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status) {
        params.set('status', `eq.${filters.status}`);
      }
      params.set('order', 'created_at.desc');
      const qs = params.toString();
      return apiGet<Lead[]>(`${API_BASE}/leads${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Creates a new lead via POST /leads.
 * Invalidates the leads list on success.
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation<Lead, Error, CreateLeadInput>({
    mutationFn: (input) => apiPost<Lead>(`${API_BASE}/leads`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/**
 * Updates a lead via PATCH /leads?id=eq.{id}.
 * Uses Prefer: return=representation so PostgREST returns the updated row.
 * Invalidates the list and updates the detail cache on success.
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation<Lead[], Error, UpdateLeadInput>({
    mutationFn: ({ id, data }) =>
      apiPatch<Lead[]>(`${API_BASE}/leads?id=eq.${id}`, data),
    onSuccess: (rows, { id }) => {
      if (rows.length > 0) {
        queryClient.setQueryData(leadKeys.detail(id), rows[0]);
      }
      queryClient.invalidateQueries({ queryKey: leadKeys.list() });
    },
  });
}
