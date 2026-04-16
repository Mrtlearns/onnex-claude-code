import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';
import { useUpdateLead } from '@/hooks/useLeads';
import { KanbanCard, KanbanCardOverlay } from '@/components/KanbanCard';
import type { Lead, LeadStatus, InjuryType, LeadSource } from '@/types';

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------
const COLUMNS: {
  status: LeadStatus;
  label: string;
  headerBg: string;
}[] = [
  { status: 'new',                label: 'New',               headerBg: 'bg-blue-500' },
  { status: 'contacted',          label: 'Contacted',         headerBg: 'bg-amber-500' },
  { status: 'intake-in-progress', label: 'Intake In Progress', headerBg: 'bg-orange-500' },
  { status: 'signed',             label: 'Signed',            headerBg: 'bg-green-500' },
  { status: 'lost',               label: 'Lost',              headerBg: 'bg-slate-500' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface KanbanFilters {
  injuryTypes: InjuryType[];
  sources: LeadSource[];
  highPriorityOnly: boolean;
}

interface LeadsKanbanProps {
  leads: Lead[];
  filters: KanbanFilters;
  activeStatusTab: LeadStatus | 'all' | 'high-priority';
  onCardClick: (lead: Lead) => void;
}

// ---------------------------------------------------------------------------
// Helper — split leads into column map
// ---------------------------------------------------------------------------
function buildColumns(leads: Lead[]): Record<LeadStatus, Lead[]> {
  const map: Record<LeadStatus, Lead[]> = {
    new: [],
    contacted: [],
    'intake-in-progress': [],
    signed: [],
    lost: [],
  };
  for (const lead of leads) {
    map[lead.status]?.push(lead);
  }
  return map;
}

// ---------------------------------------------------------------------------
// LeadsKanban
// ---------------------------------------------------------------------------
export default function LeadsKanban({
  leads,
  filters,
  activeStatusTab,
  onCardClick,
}: LeadsKanbanProps) {
  const updateLead = useUpdateLead();

  // Apply client-side filters
  const filtered = leads.filter((l) => {
    if (filters.injuryTypes.length > 0 && !filters.injuryTypes.includes(l.injury_type)) return false;
    if (filters.sources.length > 0 && !filters.sources.includes(l.source)) return false;
    if (filters.highPriorityOnly && (l.lead_score === null || l.lead_score < 70)) return false;
    return true;
  });

  // Local optimistic state
  const isDraggingRef = useRef(false);
  const [colItems, setColItems] = useState<Record<LeadStatus, Lead[]>>(() => buildColumns(filtered));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync when leads prop changes (refetch) — skip during active drag to preserve optimistic state
  useEffect(() => {
    if (isDraggingRef.current) return;
    setColItems(buildColumns(filtered));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, filters]);

  // Which columns to show based on status tab
  const visibleStatuses: LeadStatus[] = (() => {
    if (activeStatusTab === 'all' || activeStatusTab === 'high-priority') {
      return COLUMNS.map((c) => c.status);
    }
    return [activeStatusTab as LeadStatus];
  })();

  // Active lead for overlay
  const activeLead = activeId
    ? Object.values(colItems).flat().find((l) => l.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = String(active.id);
    const overId = String(over.id);

    // over.id can be a column status string OR a card UUID (when the drop lands on a card,
    // not empty column space). Resolve to the target column status.
    const validStatuses = new Set<string>(COLUMNS.map((c) => c.status));
    let overStatus: LeadStatus;
    if (validStatuses.has(overId)) {
      overStatus = overId as LeadStatus;
    } else {
      // overId is a card UUID — find which column it belongs to
      let resolved: LeadStatus | null = null;
      for (const [status, items] of Object.entries(colItems)) {
        if (items.some((l) => l.id === overId)) {
          resolved = status as LeadStatus;
          break;
        }
      }
      if (!resolved) return;
      overStatus = resolved;
    }

    // Find source column
    let sourceStatus: LeadStatus | null = null;
    for (const [status, items] of Object.entries(colItems)) {
      if (items.some((l) => l.id === activeLeadId)) {
        sourceStatus = status as LeadStatus;
        break;
      }
    }
    if (!sourceStatus || sourceStatus === overStatus) return;

    // Optimistic update
    const prevColItems = { ...colItems };
    setColItems((prev) => {
      const lead = prev[sourceStatus!].find((l) => l.id === activeLeadId);
      if (!lead) return prev;
      return {
        ...prev,
        [sourceStatus!]: prev[sourceStatus!].filter((l) => l.id !== activeLeadId),
        [overStatus]: [{ ...lead, status: overStatus }, ...(prev[overStatus] ?? [])],
      };
    });

    // Persist
    updateLead.mutate(
      { id: activeLeadId, data: { status: overStatus } },
      {
        onError: () => {
          // Revert on failure
          setColItems(prevColItems);
        },
      },
    );
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.filter((c) => visibleStatuses.includes(c.status)).map((col) => {
          const items = colItems[col.status] ?? [];
          return (
            <div key={col.status} className="flex-shrink-0 w-64 flex flex-col">
              {/* Column header */}
              <div
                className={`${col.headerBg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}
              >
                <span className="text-xs font-semibold text-white">{col.label}</span>
                <span className="text-xs font-medium text-white/80">{items.length}</span>
              </div>

              {/* Drop zone */}
              <SortableContext
                id={col.status}
                items={items.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
                  <AnimatePresence initial={false}>
                    {items.map((lead) => (
                      <KanbanCard key={lead.id} lead={lead} onClick={onCardClick} />
                    ))}
                  </AnimatePresence>
                  {items.length === 0 && (
                    <div className="flex-1 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400 min-h-[80px]">
                      Drop here
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeLead ? (
          <KanbanCardOverlay lead={activeLead} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
