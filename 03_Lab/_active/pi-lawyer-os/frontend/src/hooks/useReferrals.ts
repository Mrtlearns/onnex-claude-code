import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { PartnerReferral, CreateReferralInput } from '../types';

export const referralKeys = {
  all: ['referrals'] as const,
  byPartner: (partnerId: string) => [...referralKeys.all, 'partner', partnerId] as const,
  byLead: (leadId: string) => [...referralKeys.all, 'lead', leadId] as const,
};

export function usePartnerReferrals(partnerId: string) {
  return useQuery<PartnerReferral[]>({
    queryKey: referralKeys.byPartner(partnerId),
    queryFn: () =>
      apiGet<PartnerReferral[]>(
        `${API_BASE}/partner_referrals?partner_id=eq.${partnerId}&order=referred_at.desc`
      ),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
  });
}

export function useLeadReferral(leadId: string | null | undefined) {
  return useQuery<PartnerReferral | null>({
    queryKey: referralKeys.byLead(leadId ?? ''),
    queryFn: () =>
      leadId
        ? apiGet<PartnerReferral[]>(
            `${API_BASE}/partner_referrals?lead_id=eq.${leadId}&limit=1`
          ).then((r) => r[0] ?? null)
        : Promise.resolve(null),
    enabled: !!leadId,
    staleTime: 30 * 1000,
  });
}

export function useCreateReferral() {
  const queryClient = useQueryClient();
  return useMutation<PartnerReferral, Error, CreateReferralInput>({
    mutationFn: (input) => apiPost<PartnerReferral>(`${API_BASE}/partner_referrals`, input),
    onSuccess: (_, { partner_id, lead_id }) => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
      if (partner_id) queryClient.invalidateQueries({ queryKey: referralKeys.byPartner(partner_id) });
      if (lead_id) queryClient.invalidateQueries({ queryKey: referralKeys.byLead(lead_id) });
    },
  });
}

export function useUpdateReferral() {
  const queryClient = useQueryClient();
  return useMutation<
    PartnerReferral[],
    Error,
    { id: string; data: Partial<PartnerReferral> }
  >({
    mutationFn: ({ id, data }) =>
      apiPatch<PartnerReferral[]>(`${API_BASE}/partner_referrals?id=eq.${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}
