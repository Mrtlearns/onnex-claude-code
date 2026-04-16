import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../lib/api';
import type { KpiSolAlert, KpiTasksDue } from '../types';

export function useSolAlerts() {
  return useQuery<KpiSolAlert[]>({
    queryKey: ['kpi', 'sol_alerts'],
    queryFn: () => apiGet<KpiSolAlert[]>(`${API_BASE}/kpi_sol_alerts`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTasksDue() {
  return useQuery<KpiTasksDue[]>({
    queryKey: ['kpi', 'tasks_due'],
    queryFn: () => apiGet<KpiTasksDue[]>(`${API_BASE}/kpi_tasks_due`),
    staleTime: 60 * 1000,
  });
}
