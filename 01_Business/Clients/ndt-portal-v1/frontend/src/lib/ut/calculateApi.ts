/**
 * API client for UT rule engine calculations.
 * Replaces frontend-side calculation with backend API calls.
 */

import type { CalculateRequest, CalculateResponse, AvailableVersions } from './types-rules';
import { getAuthHeaders } from '@/lib/api';

const API_BASE = '/api/ut';

export async function calculateUt(req: CalculateRequest): Promise<CalculateResponse> {
  const res = await fetch(`${API_BASE}/calculate`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Calculate failed (${res.status})`);
  }

  return (await res.json()) as CalculateResponse;
}

export async function fetchAvailableVersions(customerId: string): Promise<AvailableVersions> {
  const res = await fetch(`${API_BASE}/ut-rules/versions/available?customerId=${customerId}`, {
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });

  if (!res.ok) {
    throw new Error(`Fetch versions failed (${res.status})`);
  }

  return (await res.json()) as AvailableVersions;
}
