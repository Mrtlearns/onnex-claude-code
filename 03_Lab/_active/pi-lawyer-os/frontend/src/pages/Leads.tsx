import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, LayoutList, LayoutDashboard } from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useLeads } from '@/hooks/useLeads';
import { getUser } from '@/lib/auth';
import LeadIntakeForm from '@/components/LeadIntakeForm';
import LeadsKanban from '@/components/LeadsKanban';
import type { KanbanFilters } from '@/components/LeadsKanban';
import type { LeadStatus, InjuryType, LeadSource } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_TABS: { label: string; value: LeadStatus | 'all' | 'high-priority' }[] = [
  { label: 'All', value: 'all' },
  { label: 'High Priority', value: 'high-priority' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Intake In Progress', value: 'intake-in-progress' },
  { label: 'Signed', value: 'signed' },
  { label: 'Lost', value: 'lost' },
];

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  'intake-in-progress': 'bg-orange-100 text-orange-800',
  signed: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  'intake-in-progress': 'Intake In Progress',
  signed: 'Signed',
  lost: 'Lost',
};

const INJURY_LABEL: Record<InjuryType, string> = {
  auto: 'Auto Accident',
  'slip-fall': 'Slip & Fall',
  'dog-bite': 'Dog Bite',
  'premises-liability': 'Premises Liability',
  other: 'Other',
};

const INJURY_OPTIONS: InjuryType[] = ['auto', 'slip-fall', 'dog-bite', 'premises-liability', 'other'];

const SOURCE_LABEL: Record<LeadSource, string> = {
  'web-form': 'Web Form',
  phone: 'Phone',
  sms: 'SMS',
  referral: 'Referral',
  google: 'Google',
  review: 'Review',
};

const SOURCE_OPTIONS: LeadSource[] = ['web-form', 'phone', 'sms', 'referral', 'google', 'review'];

// ---------------------------------------------------------------------------
// Filter persistence
// ---------------------------------------------------------------------------
function getStorageKey() {
  const uid = getUser()?.id ?? 'anon';
  return `plo_kanban_filters_${uid}`;
}

function loadFilters(): KanbanFilters {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) return JSON.parse(raw) as KanbanFilters;
  } catch {
    // ignore
  }
  return { injuryTypes: [], sources: [], highPriorityOnly: false };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>;
  const cls =
    score >= 70 ? 'bg-green-100 text-green-800' :
    score >= 40 ? 'bg-yellow-100 text-yellow-800' :
    'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Multi-select dropdown for kanban filter bar
// ---------------------------------------------------------------------------
function MultiSelect<T extends string>({
  label,
  options,
  optionLabels,
  selected,
  onChange,
}: {
  label: string;
  options: T[];
  optionLabels: Record<T, string>;
  selected: T[];
  onChange: (val: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (opt: T) => {
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-semibold">
            {selected.length}
          </span>
        )}
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-gray-200 bg-white shadow-lg py-1 min-w-[140px]">
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="rounded border-gray-300 text-blue-600"
                />
                {optionLabels[opt]}
              </label>
            ))}
            {selected.length > 0 && (
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100 mt-1"
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Leads() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [activeStatus, setActiveStatus] = useState<LeadStatus | 'all' | 'high-priority'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<KanbanFilters>(loadFilters);

  // Persist filters on change
  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  // In list mode, filter by tab status; in kanban mode always fetch all
  const { data: allLeads, isLoading, isError } = useLeads(
    view === 'list' && activeStatus !== 'all' && activeStatus !== 'high-priority'
      ? { status: activeStatus as LeadStatus }
      : undefined,
  );

  const leads = view === 'list' && activeStatus === 'high-priority'
    ? (allLeads ?? []).filter((l) => l.lead_score !== null && l.lead_score >= 70)
    : allLeads;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm p-0.5">
            <button
              onClick={() => setView('list')}
              className={[
                'rounded-md p-1.5 transition-colors',
                view === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600',
              ].join(' ')}
              title="List view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={[
                'rounded-md p-1.5 transition-colors',
                view === 'kanban' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600',
              ].join(' ')}
              title="Kanban view"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
          </div>

          {/* New Lead */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg" onClose={() => setDialogOpen(false)}>
              <DialogHeader>
                <DialogTitle>Create New Lead</DialogTitle>
              </DialogHeader>
              <LeadIntakeForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-px">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveStatus(tab.value)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              activeStatus === tab.value
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Kanban filter bar (kanban mode only) */}
      {view === 'kanban' && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Filter:</span>
          <MultiSelect
            label="Injury Type"
            options={INJURY_OPTIONS}
            optionLabels={INJURY_LABEL}
            selected={filters.injuryTypes}
            onChange={(v) => setFilters((f) => ({ ...f, injuryTypes: v }))}
          />
          <MultiSelect
            label="Source"
            options={SOURCE_OPTIONS}
            optionLabels={SOURCE_LABEL}
            selected={filters.sources}
            onChange={(v) => setFilters((f) => ({ ...f, sources: v }))}
          />
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.highPriorityOnly}
              onChange={(e) => setFilters((f) => ({ ...f, highPriorityOnly: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600"
            />
            High priority only
          </label>
          {(filters.injuryTypes.length > 0 || filters.sources.length > 0 || filters.highPriorityOnly) && (
            <button
              onClick={() => setFilters({ injuryTypes: [], sources: [], highPriorityOnly: false })}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <>
          {isLoading && (
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-64 h-48 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}
          {isError && (
            <p className="text-red-500 text-sm">Failed to load leads. Please refresh.</p>
          )}
          {allLeads !== undefined && !isError && (
            <LeadsKanban
              leads={allLeads ?? []}
              filters={filters}
              activeStatusTab={activeStatus}
              onCardClick={(lead) => navigate(`/leads/${lead.id}`)}
            />
          )}
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Score', 'Phone', 'Injury Type', 'Source', 'Status', 'Created'].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                    Failed to load leads. Please refresh.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && leads?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <p className="text-base font-medium">No leads found</p>
                    <p className="mt-1 text-sm">
                      {activeStatus === 'all'
                        ? 'Create your first lead using the "New Lead" button above.'
                        : activeStatus === 'high-priority'
                        ? 'No high-priority leads (score ≥ 70) yet.'
                        : `No leads with status "${STATUS_LABEL[activeStatus as LeadStatus]}".`}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                leads?.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-blue-600 whitespace-nowrap">
                      <a
                        href={`/leads/${lead.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/leads/${lead.id}`); }}
                        className="hover:underline"
                      >
                        {lead.first_name} {lead.last_name}
                      </a>
                      {lead.is_duplicate && (
                        <span className="ml-1.5 text-xs text-amber-600 font-normal">dup</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ScoreBadge score={lead.lead_score ?? null} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {lead.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {INJURY_LABEL[lead.injury_type] ?? lead.injury_type}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABEL[lead.source] ?? lead.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          STATUS_BADGE[lead.status],
                        ].join(' ')}
                      >
                        {STATUS_LABEL[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {relativeTime(lead.created_at)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
