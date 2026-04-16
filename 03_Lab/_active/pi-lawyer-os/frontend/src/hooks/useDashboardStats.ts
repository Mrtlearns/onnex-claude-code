import { useQueries } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../lib/api';
import type {
  DashboardStats,
  KpiResponseTime,
  KpiRecoveryRate,
  KpiLeadsByStatus,
  KpiIntakeCompletion,
} from '../types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const dashboardKeys = {
  all: ['dashboard'] as const,
  responseTime: () => [...dashboardKeys.all, 'response_time'] as const,
  recoveryRate: () => [...dashboardKeys.all, 'recovery_rate'] as const,
  leadsByStatus: () => [...dashboardKeys.all, 'leads_by_status'] as const,
  intakeCompletion: () => [...dashboardKeys.all, 'intake_completion'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fires four parallel queries against the PostgREST KPI views and assembles
 * them into a single DashboardStats object. Each KPI endpoint returns an
 * array; we take the first element (scoped to the firm via RLS) or null.
 *
 * Returns:
 *  - `data`      — DashboardStats when all queries have resolved
 *  - `isLoading` — true while any query is still pending
 *  - `isError`   — true if any query failed
 *  - `errors`    — array of per-query errors (null when query succeeded)
 */
export function useDashboardStats(): {
  data: DashboardStats | null;
  isLoading: boolean;
  isError: boolean;
  errors: (Error | null)[];
} {
  const results = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.responseTime(),
        queryFn: () => apiGet<KpiResponseTime[]>(`${API_BASE}/kpi_response_time`),
        staleTime: 60 * 1000,
      },
      {
        queryKey: dashboardKeys.recoveryRate(),
        queryFn: () => apiGet<KpiRecoveryRate[]>(`${API_BASE}/kpi_recovery_rate`),
        staleTime: 60 * 1000,
      },
      {
        queryKey: dashboardKeys.leadsByStatus(),
        queryFn: () => apiGet<KpiLeadsByStatus[]>(`${API_BASE}/kpi_leads_by_status`),
        staleTime: 60 * 1000,
      },
      {
        queryKey: dashboardKeys.intakeCompletion(),
        queryFn: () =>
          apiGet<KpiIntakeCompletion[]>(`${API_BASE}/kpi_intake_completion`),
        staleTime: 60 * 1000,
      },
    ],
  });

  const [responseTimeQ, recoveryRateQ, leadsByStatusQ, intakeCompletionQ] =
    results;

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const errors = results.map((r) => (r.error as Error | null) ?? null);

  if (isLoading || isError) {
    return { data: null, isLoading, isError, errors };
  }

  const data: DashboardStats = {
    response_time: responseTimeQ.data?.[0] ?? null,
    recovery_rate: recoveryRateQ.data?.[0] ?? null,
    leads_by_status: leadsByStatusQ.data ?? [],
    intake_completion: intakeCompletionQ.data?.[0] ?? null,
  };

  return { data, isLoading, isError, errors };
}
