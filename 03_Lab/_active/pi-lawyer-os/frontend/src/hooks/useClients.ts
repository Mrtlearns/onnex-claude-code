import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, API_BASE } from '../lib/api';
import type { Client } from '../types';

export const clientKeys = {
  all: ['clients'] as const,
  list: () => [...clientKeys.all, 'list'] as const,
  detail: (id: string) => [...clientKeys.all, 'detail', id] as const,
};

type CreateClientInput = Omit<Client, 'id' | 'firm_id' | 'created_at' | 'updated_at'>;
interface UpdateClientInput {
  id: string;
  data: Partial<Omit<Client, 'id' | 'firm_id' | 'created_at' | 'updated_at'>>;
}

export function useClients() {
  return useQuery<Client[]>({
    queryKey: clientKeys.list(),
    queryFn: () =>
      apiGet<Client[]>(`${API_BASE}/clients?order=last_name.asc,first_name.asc`),
    staleTime: 60 * 1000,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, CreateClientInput>({
    mutationFn: (input) => apiPost<Client>(`${API_BASE}/clients`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client[], Error, UpdateClientInput>({
    mutationFn: ({ id, data }) =>
      apiPatch<Client[]>(`${API_BASE}/clients?id=eq.${id}`, data),
    onSuccess: (rows, { id }) => {
      if (rows.length > 0) queryClient.setQueryData(clientKeys.detail(id), rows[0]);
      queryClient.invalidateQueries({ queryKey: clientKeys.list() });
    },
  });
}
