import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { Task, TaskStatus } from '../types';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: { case_id?: string; assigned_to?: string; status?: TaskStatus }) =>
    [...taskKeys.all, 'list', filters ?? {}] as const,
};

type CreateTaskInput = Omit<Task, 'id' | 'firm_id' | 'created_at' | 'updated_at'>;
interface UpdateTaskInput {
  id: string;
  data: Partial<Omit<Task, 'id' | 'firm_id' | 'created_at' | 'updated_at'>>;
}

export function useTasks(filters?: { case_id?: string; assigned_to?: string; status?: TaskStatus }) {
  return useQuery<Task[]>({
    queryKey: taskKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.case_id) params.set('case_id', `eq.${filters.case_id}`);
      if (filters?.assigned_to) params.set('assigned_to', `eq.${filters.assigned_to}`);
      if (filters?.status) params.set('status', `eq.${filters.status}`);
      else params.set('status', 'not.in.(completed,cancelled)');
      params.set('order', 'due_date.asc.nullslast');
      return apiGet<Task[]>(`${API_BASE}/tasks?${params.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: (input) => apiPost<Task>(`${API_BASE}/tasks`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation<Task[], Error, UpdateTaskInput>({
    mutationFn: ({ id, data }) =>
      apiPatch<Task[]>(`${API_BASE}/tasks?id=eq.${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
