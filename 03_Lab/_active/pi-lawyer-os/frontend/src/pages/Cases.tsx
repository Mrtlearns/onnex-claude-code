import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, AlertTriangle, LayoutList, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCases } from '@/hooks/useCases';
import CaseCreateForm from '@/components/CaseCreateForm';
import CasesKanban from '@/components/CasesKanban';
import type { CaseStatus, CaseType } from '@/types';

// ── Constants ──────────────────────────────────────────────

const STATUS_TABS: { label: string; value: CaseStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Intake', value: 'intake' },
  { label: 'Investigation', value: 'investigation' },
  { label: 'Demand', value: 'demand' },
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Settlement', value: 'settlement' },
  { label: 'Litigation', value: 'litigation' },
  { label: 'Closed', value: 'closed' },
];

const STATUS_BADGE: Record<CaseStatus, string> = {
  intake: 'bg-blue-100 text-blue-800',
  investigation: 'bg-yellow-100 text-yellow-800',
  demand: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-purple-100 text-purple-800',
  settlement: 'bg-green-100 text-green-800',
  litigation: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-600',
};

const CASE_TYPE_LABEL: Record<CaseType, string> = {
  auto: 'Auto Accident',
  'slip-fall': 'Slip & Fall',
  'dog-bite': 'Dog Bite',
  'premises-liability': 'Premises Liability',
  other: 'Other',
};

function solBadge(solDate: string | null) {
  if (!solDate) return null;
  const days = Math.floor((new Date(solDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-600 text-white"><AlertTriangle className="w-3 h-3" />PAST SOL</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3" />{days}d</span>;
  if (days <= 60) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">{days}d</span>;
  if (days <= 90) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800">{days}d</span>;
  return <span className="text-sm text-gray-500">{new Date(solDate).toLocaleDateString()}</span>;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>
      ))}
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────

export default function Cases() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [activeStatus, setActiveStatus] = useState<CaseStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: allCases, isLoading, isError } = useCases(
    view === 'list' && activeStatus !== 'all' ? { status: activeStatus } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Case
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg" onClose={() => setDialogOpen(false)}>
            <DialogHeader>
              <DialogTitle>Create New Case</DialogTitle>
            </DialogHeader>
            <CaseCreateForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Status tabs */}
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

      {/* Kanban view */}
      {view === 'kanban' && (
        <>
          {isLoading && (
            <div className="flex gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-64 h-48 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}
          {isError && (
            <p className="text-red-500 text-sm">Failed to load cases. Please refresh.</p>
          )}
          {allCases !== undefined && !isError && (
            <CasesKanban
              cases={allCases}
              activeStatusTab={activeStatus}
              onCardClick={(c) => navigate(`/cases/${c.id}`)}
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
              {['Case #', 'Client', 'Type', 'Status', 'SOL Date', 'Attorney'].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500">
                  Failed to load cases. Please refresh.
                </td>
              </tr>
            )}

            {!isLoading && !isError && allCases?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  <p className="text-base font-medium">No cases found</p>
                  <p className="mt-1 text-sm">Create a case from a signed lead or use the New Case button.</p>
                </td>
              </tr>
            )}

            {!isLoading && !isError && allCases?.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-blue-600 whitespace-nowrap">
                  <Link to={`/cases/${c.id}`} className="hover:underline">
                    {c.case_number ?? c.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {c.client ? `${c.client.first_name} ${c.client.last_name}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{CASE_TYPE_LABEL[c.case_type] ?? c.case_type}</td>
                <td className="px-4 py-3">
                  <span className={[
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    STATUS_BADGE[c.status],
                  ].join(' ')}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{solBadge(c.sol_date)}</td>
                <td className="px-4 py-3 text-gray-500">{c.assigned_attorney ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
