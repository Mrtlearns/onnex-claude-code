import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle } from 'lucide-react';
import type { Case, CaseType } from '@/types';

const CASE_TYPE_LABEL: Record<CaseType, string> = {
  auto: 'Auto Accident',
  'slip-fall': 'Slip & Fall',
  'dog-bite': 'Dog Bite',
  'premises-liability': 'Premises Liability',
  other: 'Other',
};

const STATUS_COLOR: Record<string, string> = {
  intake: '#3b82f6',
  investigation: '#eab308',
  demand: '#f97316',
  negotiation: '#a855f7',
  settlement: '#22c55e',
  litigation: '#ef4444',
  closed: '#64748b',
};

function SolChip({ solDate }: { solDate: string | null }) {
  if (!solDate) return null;
  const days = Math.floor((new Date(solDate).getTime() - Date.now()) / 86400000);
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white">
        <AlertTriangle className="w-2.5 h-2.5" />PAST
      </span>
    );
  if (days <= 30)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-800">
        <AlertTriangle className="w-2.5 h-2.5" />{days}d
      </span>
    );
  if (days <= 90)
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800">
        {days}d
      </span>
    );
  return null;
}

function CardBody({ caseItem }: { caseItem: Case }) {
  const clientName = caseItem.client
    ? `${caseItem.client.first_name} ${caseItem.client.last_name}`
    : '—';

  return (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold text-blue-600 leading-tight">
          {caseItem.case_number ?? caseItem.id.slice(0, 8)}
        </p>
        <SolChip solDate={caseItem.sol_date} />
      </div>
      <p className="mt-1 text-sm font-medium text-gray-800 leading-tight truncate">{clientName}</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-xs text-gray-500 truncate">
          {CASE_TYPE_LABEL[caseItem.case_type] ?? caseItem.case_type}
        </span>
        {caseItem.assigned_attorney && (
          <span className="text-[10px] text-gray-400 truncate max-w-[80px]">
            {caseItem.assigned_attorney}
          </span>
        )}
      </div>
    </>
  );
}

interface CasesKanbanCardProps {
  caseItem: Case;
  onClick: (c: Case) => void;
}

export function CasesKanbanCard({ caseItem, onClick }: CasesKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: caseItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `3px solid ${STATUS_COLOR[caseItem.status] ?? '#64748b'}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(caseItem)}
      className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-md rounded-xl p-3 cursor-pointer hover:shadow-lg hover:bg-white/95 transition-shadow select-none"
    >
      <CardBody caseItem={caseItem} />
    </div>
  );
}

export function CasesKanbanCardOverlay({ caseItem }: { caseItem: Case }) {
  return (
    <div
      className="bg-white/95 backdrop-blur-sm border border-white/50 shadow-xl rounded-xl p-3 cursor-grabbing"
      style={{ borderLeft: `3px solid ${STATUS_COLOR[caseItem.status] ?? '#64748b'}` }}
    >
      <CardBody caseItem={caseItem} />
    </div>
  );
}
