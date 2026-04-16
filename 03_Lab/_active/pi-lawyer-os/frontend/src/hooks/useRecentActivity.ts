import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../lib/api';
import { useCurrentUser } from './useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogRow {
  id: string;
  firm_id: string;
  actor_id: string | null;
  action: string;         // 'INSERT' | 'UPDATE' | 'DELETE'
  entity_type: string;    // TG_TABLE_NAME: 'leads', 'cases', 'communications', etc.
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  time: string;   // HH:MM:SS
  icon: string;
  message: string;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'plo_activity_limit';
const VALID_LIMITS = [25, 50, 100, 200] as const;
export type ActivityLimit = typeof VALID_LIMITS[number];

export function readActivityLimit(): ActivityLimit {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if ((VALID_LIMITS as readonly number[]).includes(n)) return n as ActivityLimit;
  } catch { /* ignore */ }
  return 50;
}

export function writeActivityLimit(limit: ActivityLimit): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(limit));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Message formatting helpers
// ---------------------------------------------------------------------------

const INFRA_FIELDS = new Set(['id', 'firm_id', 'created_at', 'updated_at']);

function firstChangedField(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): { field: string; oldVal: unknown; newVal: unknown } | null {
  if (!oldData || !newData) return null;
  for (const key of Object.keys(newData)) {
    if (INFRA_FIELDS.has(key)) continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      return { field: key, oldVal: oldData[key], newVal: newData[key] };
    }
  }
  return null;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatMessage(row: AuditLogRow): { icon: string; message: string } {
  const d = row.new_data ?? row.old_data ?? {};
  const action = row.action;
  const entity = row.entity_type;

  if (entity === 'leads') {
    const name = `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || 'Unknown';
    if (action === 'INSERT') {
      const injury = String(d.injury_type ?? '').replace(/-/g, ' ');
      const source = String(d.source ?? '');
      return { icon: '👤', message: `New lead: ${name}${injury ? ` (${injury})` : ''}${source ? ` via ${source}` : ''}` };
    }
    if (action === 'DELETE') {
      return { icon: '🗑️', message: `Lead ${name} deleted` };
    }
    // UPDATE
    const changed = firstChangedField(row.old_data, row.new_data);
    if (changed) {
      return { icon: '✏️', message: `Lead ${name} — ${changed.field}: ${changed.oldVal} → ${changed.newVal}` };
    }
    return { icon: '✏️', message: `Lead ${name} updated` };
  }

  if (entity === 'cases') {
    const caseNum = String(d.case_number ?? row.entity_id.slice(0, 8));
    if (action === 'INSERT') {
      return { icon: '📋', message: `New case ${caseNum} opened` };
    }
    if (action === 'DELETE') {
      return { icon: '📋', message: `Case ${caseNum} deleted` };
    }
    const changed = firstChangedField(row.old_data, row.new_data);
    const fieldNote = changed ? ` — ${changed.field} updated` : ' updated';
    return { icon: '📋', message: `Case ${caseNum}${fieldNote}` };
  }

  if (entity === 'communications') {
    const channel = String(d.channel ?? 'message');
    const direction = String(d.direction ?? '');
    return { icon: '💬', message: `${channel}${direction ? ` ${direction}` : ''} on lead` };
  }

  if (entity === 'tasks') {
    const title = String(d.title ?? 'task');
    if (action === 'INSERT') {
      return { icon: '✅', message: `Task created: ${title}` };
    }
    return { icon: '✔️', message: `Task ${title} — status updated` };
  }

  if (entity === 'settlement_offers') {
    const amount = d.offer_amount != null ? `$${Number(d.offer_amount).toLocaleString()}` : '';
    return { icon: '💰', message: `Settlement offer${amount ? ` ${amount}` : ''} on case` };
  }

  if (entity === 'medical_providers') {
    const name = String(d.name ?? '');
    if (action === 'UPDATE') {
      const newStatus = (row.new_data ?? {})['request_status'];
      if (newStatus === 'received') {
        return { icon: '🏥', message: `Records received from ${name || 'provider'}` };
      }
      return { icon: '🏥', message: `Medical provider updated${name ? `: ${name}` : ''}` };
    }
    return { icon: '🏥', message: `Provider added: ${name || 'unknown'}` };
  }

  if (entity === 'case_costs') {
    const costType = String(d.cost_type ?? 'cost').replace(/_/g, ' ');
    const amount = d.amount != null ? `$${Number(d.amount).toLocaleString()}` : '';
    if (action === 'INSERT') {
      return { icon: '💵', message: `Case cost: ${costType}${amount ? ` ${amount}` : ''}` };
    }
    return { icon: '💵', message: `Case cost updated` };
  }

  if (entity === 'partner_referrals') {
    if (action === 'INSERT') {
      return { icon: '🤝', message: `Partner referral recorded` };
    }
    return { icon: '🤝', message: `Partner referral updated` };
  }

  return { icon: '🔔', message: `${entity} ${action.toLowerCase()}` };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecentActivity(limit: ActivityLimit = 50) {
  const { data: currentUser } = useCurrentUser();
  const firmId = currentUser?.firm_id;

  return useQuery({
    queryKey: ['activity_feed', limit, firmId],
    queryFn: () =>
      apiGet<AuditLogRow[]>(
        `${API_BASE}/audit_log?firm_id=eq.${firmId}&order=created_at.desc&limit=${limit}`,
      ),
    enabled: !!firmId,
    refetchInterval: 5000,
    staleTime: 4000,
    select: (rows): ActivityEntry[] =>
      rows.map((row) => {
        const { icon, message } = formatMessage(row);
        return { id: row.id, time: fmtTime(row.created_at), icon, message };
      }),
  });
}
