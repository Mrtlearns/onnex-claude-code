import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  Flame,
  Car, Footprints, PawPrint, Building2, HelpCircle,
  Globe, Phone, MessageSquare, Users, Search, Star,
  type LucideIcon,
} from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import type { Lead, InjuryType, LeadSource } from '@/types';

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------
const INJURY_CONFIG: Record<InjuryType, { label: string; color: string; Icon: LucideIcon }> = {
  auto:                 { label: 'Auto',      color: '#3b82f6', Icon: Car },
  'slip-fall':          { label: 'Slip & Fall', color: '#f97316', Icon: Footprints },
  'dog-bite':           { label: 'Dog Bite',  color: '#ef4444', Icon: PawPrint },
  'premises-liability': { label: 'Premises',  color: '#a855f7', Icon: Building2 },
  other:                { label: 'Other',     color: '#94a3b8', Icon: HelpCircle },
};

const SOURCE_ICON: Record<LeadSource, LucideIcon> = {
  'web-form': Globe,
  phone:      Phone,
  sms:        MessageSquare,
  referral:   Users,
  google:     Search,
  review:     Star,
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  'web-form': 'Web Form',
  phone:      'Phone',
  sms:        'SMS',
  referral:   'Referral',
  google:     'Google',
  review:     'Review',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;

  const priorityLabel = score >= 70 ? 'High' : score >= 40 ? 'Med' : 'Low';
  const priorityCls =
    score >= 70 ? 'bg-red-500 text-white' :
    score >= 40 ? 'bg-amber-400 text-white' :
    'bg-slate-400 text-white';

  return (
    <div className="flex items-center gap-1.5">
      <span className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">
        {score}
      </span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityCls}`}>
        {priorityLabel}
      </span>
    </div>
  );
}

function InitialsAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Card body — shared between KanbanCard and KanbanCardOverlay
// ---------------------------------------------------------------------------
function CardBody({ lead }: { lead: Lead }) {
  const injury = INJURY_CONFIG[lead.injury_type] ?? INJURY_CONFIG.other;
  const InjuryIcon = injury.Icon;
  const SourceIcon = SOURCE_ICON[lead.source] ?? Globe;
  const isHighPriority = lead.lead_score !== null && lead.lead_score >= 70;

  return (
    <>
      {/* Row 1: name + injury icon */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold text-gray-800 leading-tight">
          {lead.first_name} {lead.last_name}
        </p>
        <InjuryIcon
          className="h-4 w-4 shrink-0 mt-0.5"
          style={{ color: injury.color }}
          aria-label={injury.label}
        />
      </div>

      {/* Row 2: score chip + priority badge */}
      <div className="mt-2">
        <ScoreBadge score={lead.lead_score ?? null} />
      </div>

      {/* Row 3: initials avatar + source + time + flame/dup */}
      <div className="mt-2 flex items-center gap-1.5">
        <InitialsAvatar firstName={lead.first_name} lastName={lead.last_name} />
        <SourceIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-500 truncate flex-1">{SOURCE_LABEL[lead.source] ?? lead.source}</span>
        <span className="text-xs text-gray-400 whitespace-nowrap">{relativeTime(lead.created_at)}</span>
        {isHighPriority && <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
        {lead.is_duplicate && (
          <span className="text-xs font-medium bg-amber-400 text-white px-1.5 py-0.5 rounded shrink-0">dup</span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// KanbanCard — draggable card
// ---------------------------------------------------------------------------
interface KanbanCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  /** When true, renders as a static drag-overlay ghost (no drag handle needed) */
  isOverlay?: boolean;
}

export function KanbanCard({ lead, onClick, isOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  const injury = INJURY_CONFIG[lead.injury_type] ?? INJURY_CONFIG.other;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.4 : 1,
    borderLeft: `3px solid ${injury.color}`,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(lead)}
      className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-md rounded-xl p-3 cursor-pointer hover:shadow-lg hover:bg-white/95 transition-shadow select-none"
    >
      <CardBody lead={lead} />
    </motion.div>
  );
}

/** Static ghost rendered inside DragOverlay — no sortable hooks */
export function KanbanCardOverlay({ lead }: { lead: Lead; onClick?: (l: Lead) => void }) {
  const injury = INJURY_CONFIG[lead.injury_type] ?? INJURY_CONFIG.other;
  return (
    <div
      className="bg-white/95 backdrop-blur-sm border border-white/50 shadow-xl rounded-xl p-3 cursor-grabbing"
      style={{ borderLeft: `3px solid ${injury.color}` }}
    >
      <CardBody lead={lead} />
    </div>
  );
}
