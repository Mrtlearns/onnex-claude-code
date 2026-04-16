import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../lib/api';
import type {
  AnalyticsCaseSummary,
  AnalyticsLeadFunnel,
  AnalyticsReferralAttribution,
  AnalyticsPartnerPerformance,
} from '../types';

export const analyticsKeys = {
  all: ['analytics'] as const,
  caseSummary: () => [...analyticsKeys.all, 'case-summary'] as const,
  leadFunnel: () => [...analyticsKeys.all, 'lead-funnel'] as const,
  referralAttribution: () => [...analyticsKeys.all, 'referral-attribution'] as const,
  partnerPerformance: () => [...analyticsKeys.all, 'partner-performance'] as const,
  attorneyPerformance: () => [...analyticsKeys.all, 'attorney-performance'] as const,
};

export function useAnalyticsCaseSummary() {
  return useQuery<AnalyticsCaseSummary | null>({
    queryKey: analyticsKeys.caseSummary(),
    queryFn: () =>
      apiGet<AnalyticsCaseSummary[]>(`${API_BASE}/v_analytics_case_summary`).then(
        (rows) => rows[0] ?? null,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyticsLeadFunnel() {
  return useQuery<AnalyticsLeadFunnel[]>({
    queryKey: analyticsKeys.leadFunnel(),
    queryFn: () =>
      apiGet<AnalyticsLeadFunnel[]>(`${API_BASE}/v_analytics_lead_funnel`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyticsReferralAttribution() {
  return useQuery<AnalyticsReferralAttribution[]>({
    queryKey: analyticsKeys.referralAttribution(),
    queryFn: () =>
      apiGet<AnalyticsReferralAttribution[]>(`${API_BASE}/v_analytics_referral_attribution`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyticsPartnerPerformance() {
  return useQuery<AnalyticsPartnerPerformance[]>({
    queryKey: analyticsKeys.partnerPerformance(),
    queryFn: () =>
      apiGet<AnalyticsPartnerPerformance[]>(`${API_BASE}/v_analytics_partner_performance`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface AttorneyPerformanceRow {
  attorney_id: string;
  attorney_name: string;
  attorney_email: string;
  total_cases: number;
  open_cases: number;
  settled_this_year: number;
  avg_gross_settlement: number | null;
  avg_days_to_settle: number | null;
  total_fees_earned: number;
  firm_id: string;
}

export function useAttorneyPerformance() {
  return useQuery<AttorneyPerformanceRow[]>({
    queryKey: analyticsKeys.attorneyPerformance(),
    queryFn: () =>
      apiGet<AttorneyPerformanceRow[]>(`${API_BASE}/attorney_performance`),
    staleTime: 5 * 60 * 1000,
  });
}
