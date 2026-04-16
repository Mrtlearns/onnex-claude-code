import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE } from '../lib/api';
import type { Lead, Communication } from '../types';
import { leadKeys } from './useLeads';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const communicationKeys = {
  all: ['communications'] as const,
  forLead: (leadId: string) =>
    [...communicationKeys.all, 'lead', leadId] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AddNoteInput {
  lead_id: string;
  firm_id: string;
  message: string;
  /** Optional metadata to attach to the note record */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches a single lead by id using PostgREST's eq filter.
 * Returns the first (and only) element of the result array.
 */
export function useLead(id: string) {
  return useQuery<Lead>({
    queryKey: leadKeys.detail(id),
    queryFn: async () => {
      const rows = await apiGet<Lead[]>(`${API_BASE}/leads?id=eq.${id}`);
      if (rows.length === 0) {
        throw new Error(`Lead ${id} not found`);
      }
      return rows[0];
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches all communications for a lead, ordered oldest-first so thread views
 * render chronologically.
 */
export function useLeadCommunications(leadId: string) {
  return useQuery<Communication[]>({
    queryKey: communicationKeys.forLead(leadId),
    queryFn: () =>
      apiGet<Communication[]>(
        `${API_BASE}/communications?lead_id=eq.${leadId}&order=created_at.asc`,
      ),
    enabled: Boolean(leadId),
    staleTime: 15 * 1000,
  });
}

/**
 * Adds an internal note (channel='note', direction=null) to a lead's
 * communication thread. Invalidates the communications list on success.
 */
export function useAddNote() {
  const queryClient = useQueryClient();

  return useMutation<Communication, Error, AddNoteInput>({
    mutationFn: ({ lead_id, firm_id, message, metadata }) =>
      apiPost<Communication>(`${API_BASE}/communications`, {
        lead_id,
        firm_id,
        channel: 'note',
        direction: null,
        message,
        status: 'delivered',
        metadata: metadata ?? null,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: communicationKeys.forLead(data.lead_id),
      });
    },
  });
}
