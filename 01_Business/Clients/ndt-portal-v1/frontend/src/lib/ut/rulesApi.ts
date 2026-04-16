/**
 * API client for UT Rule Set CRUD operations.
 */

import type {
  RuleSet, RuleSetDetail, VersionWithRules,
  VersionDiff, PublishVersionRequest, TraceSummary,
  CalculationTrace,
} from './types-rules';
import { getAuthHeaders } from '@/lib/api';

const API_BASE = '/api/ut/ut-rules';

export async function fetchRuleSets(): Promise<RuleSet[]> {
  const res = await fetch(`${API_BASE}/rule-sets`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch rule sets failed (${res.status})`);
  return (await res.json()) as RuleSet[];
}

export async function fetchRuleSet(id: string): Promise<RuleSetDetail> {
  const res = await fetch(`${API_BASE}/rule-sets/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch rule set failed (${res.status})`);
  return (await res.json()) as RuleSetDetail;
}

export async function createRuleSet(data: { name: string; description?: string; cloneFromVersionId?: string }): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_BASE}/rule-sets`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Create failed (${res.status})`);
  }
  return (await res.json()) as { id: string; name: string };
}

export async function fetchVersion(versionId: string): Promise<VersionWithRules> {
  const res = await fetch(`${API_BASE}/versions/${versionId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch version failed (${res.status})`);
  return (await res.json()) as VersionWithRules;
}

export async function publishVersion(
  sourceVersionId: string,
  data: PublishVersionRequest,
): Promise<{ id: string; version: number }> {
  const res = await fetch(`${API_BASE}/versions/${sourceVersionId}/publish`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Publish failed (${res.status})`);
  }
  return (await res.json()) as { id: string; version: number };
}

export async function fetchVersionDiff(v1: string, v2: string): Promise<VersionDiff> {
  const res = await fetch(`${API_BASE}/versions/${v1}/diff/${v2}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Diff failed (${res.status})`);
  return (await res.json()) as VersionDiff;
}

export async function fetchTraces(opts?: { quoteId?: string; limit?: number; offset?: number }): Promise<TraceSummary[]> {
  const params = new URLSearchParams();
  if (opts?.quoteId) params.set('quoteId', opts.quoteId);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/traces${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch traces failed (${res.status})`);
  return (await res.json()) as TraceSummary[];
}

export async function fetchTrace(traceId: string): Promise<CalculationTrace> {
  const res = await fetch(`${API_BASE}/traces/${traceId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch trace failed (${res.status})`);
  return (await res.json()) as CalculationTrace;
}

export async function createRuleSetForCustomer(customerId: string): Promise<{
  id: string; name: string; versionId?: string; alreadyExisted: boolean;
}> {
  const res = await fetch(`${API_BASE}/rule-sets/create-for-customer`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Create failed (${res.status})`);
  }
  return (await res.json()) as { id: string; name: string; versionId?: string; alreadyExisted: boolean };
}

export async function assignRuleSet(
  customerId: string,
  ruleSetId: string | null,
  versionPin?: number | null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/rule-sets/assign`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ customerId, ruleSetId, versionPin: versionPin ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Assign failed (${res.status})`);
  }
}

export async function fetchRuleSetCustomers(ruleSetId: string): Promise<Array<{
  id: string; name: string; rule_version_pin: number | null;
}>> {
  const res = await fetch(`${API_BASE}/rule-sets/${ruleSetId}/customers`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch customers failed (${res.status})`);
  return (await res.json()) as Array<{ id: string; name: string; rule_version_pin: number | null }>;
}

// ── Named Variables ──────────────────────────────────────────────

export interface NamedVariablesData {
  global: Record<string, number | string>;
  customers: Array<{ id: string; name: string; variables: Record<string, number | string> }>;
}

export async function fetchNamedVariables(): Promise<NamedVariablesData> {
  const res = await fetch(`${API_BASE}/named-variables`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch named variables failed (${res.status})`);
  return (await res.json()) as NamedVariablesData;
}

export async function setGlobalNamedVariable(key: string, value: number | string): Promise<void> {
  const res = await fetch(`${API_BASE}/named-variables/global/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Set variable failed (${res.status})`);
  }
}

export async function deleteGlobalNamedVariable(key: string): Promise<void> {
  const res = await fetch(`${API_BASE}/named-variables/global/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Delete global variable failed (${res.status})`);
}

export async function setCustomerNamedVariable(customerId: string, key: string, value: number | string): Promise<void> {
  const res = await fetch(`${API_BASE}/named-variables/customer/${encodeURIComponent(customerId)}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Set customer variable failed (${res.status})`);
  }
}

export async function deleteCustomerNamedVariable(customerId: string, key: string): Promise<void> {
  const res = await fetch(`${API_BASE}/named-variables/customer/${encodeURIComponent(customerId)}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Delete customer variable failed (${res.status})`);
}
