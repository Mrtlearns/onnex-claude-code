import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  useRecentActivity,
  readActivityLimit,
  writeActivityLimit,
  type ActivityLimit,
} from '@/hooks/useRecentActivity';

const LIMIT_OPTIONS: ActivityLimit[] = [25, 50, 100, 200];

export default function RecentActivityPanel() {
  const [open, setOpen] = useState(true);
  const [limit, setLimit] = useState<ActivityLimit>(readActivityLimit);

  const { data: entries = [], isFetching } = useRecentActivity(limit);

  function handleLimitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = Number(e.target.value) as ActivityLimit;
    writeActivityLimit(val);
    setLimit(val);
  }

  return (
    <Card>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-t-lg"
      >
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          Recent Activity
          {/* Blue pulse when fetching */}
          {isFetching && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
        </span>
        <span className="flex items-center gap-3">
          {/* Limit dropdown — stops click from toggling panel */}
          <select
            value={limit}
            onChange={handleLimitChange}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="m-3">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-4">No activity recorded yet.</p>
          ) : (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">
                Latest {entries.length} events — newest first
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 px-3 py-2">
                    <span className="text-xs font-mono text-slate-400 shrink-0 w-16">
                      {entry.time}
                    </span>
                    <span className="text-sm shrink-0">{entry.icon}</span>
                    <span className="text-xs text-slate-700">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
