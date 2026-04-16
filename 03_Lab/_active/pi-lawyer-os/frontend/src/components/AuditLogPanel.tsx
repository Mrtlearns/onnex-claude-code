import { useState } from 'react';
import { apiFetch, API_BASE } from '@/lib/api';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  actor_id: string | null;
}

function actionColor(action: string) {
  if (action === 'INSERT') return 'text-green-600';
  if (action === 'DELETE') return 'text-red-500';
  return 'text-blue-600';
}

function actionLabel(action: string) {
  if (action === 'INSERT') return 'Created';
  if (action === 'DELETE') return 'Deleted';
  return 'Updated';
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface Props {
  entityType: 'lead' | 'case';
  entityId: string;
}

export default function AuditLogPanel({ entityType, entityId }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (loaded) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/audit_log?entity_type=eq.${entityType}&entity_id=eq.${entityId}&order=created_at.desc&limit=50`,
      );
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          Audit Log
          {loaded && entries.length > 0 && (
            <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{entries.length}</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 py-3">
          {loading && <p className="text-xs text-gray-400">Loading audit log…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-xs text-gray-400">No audit events recorded yet.</p>
          )}
          {!loading && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="flex items-start gap-3 text-xs">
                  <span className={`font-semibold w-14 shrink-0 ${actionColor(e.action)}`}>
                    {actionLabel(e.action)}
                  </span>
                  <span className="text-gray-500 capitalize">{e.entity_type}</span>
                  <span className="text-gray-400 ml-auto shrink-0">{fmtDate(e.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
