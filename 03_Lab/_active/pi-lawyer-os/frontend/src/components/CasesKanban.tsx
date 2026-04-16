import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useUpdateCase } from '@/hooks/useCases';
import { CasesKanbanCard, CasesKanbanCardOverlay } from '@/components/CasesKanbanCard';
import type { Case, CaseStatus } from '@/types';

const COLUMNS: { status: CaseStatus; label: string; headerBg: string }[] = [
  { status: 'intake',        label: 'Intake',        headerBg: 'bg-blue-500'   },
  { status: 'investigation', label: 'Investigation', headerBg: 'bg-yellow-500' },
  { status: 'demand',        label: 'Demand',        headerBg: 'bg-orange-500' },
  { status: 'negotiation',   label: 'Negotiation',   headerBg: 'bg-purple-500' },
  { status: 'settlement',    label: 'Settlement',    headerBg: 'bg-green-500'  },
  { status: 'litigation',    label: 'Litigation',    headerBg: 'bg-red-500'    },
  { status: 'closed',        label: 'Closed',        headerBg: 'bg-slate-500'  },
];

function buildColumns(cases: Case[]): Record<CaseStatus, Case[]> {
  const map: Record<CaseStatus, Case[]> = {
    intake: [],
    investigation: [],
    demand: [],
    negotiation: [],
    settlement: [],
    litigation: [],
    closed: [],
  };
  for (const c of cases) {
    map[c.status]?.push(c);
  }
  return map;
}

interface CasesKanbanProps {
  cases: Case[];
  activeStatusTab: CaseStatus | 'all';
  onCardClick: (c: Case) => void;
}

export default function CasesKanban({ cases, activeStatusTab, onCardClick }: CasesKanbanProps) {
  const updateCase = useUpdateCase();
  const isDraggingRef = useRef(false);

  const [colItems, setColItems] = useState<Record<CaseStatus, Case[]>>(() => buildColumns(cases));
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setColItems(buildColumns(cases));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases]);

  const visibleStatuses: CaseStatus[] =
    activeStatusTab === 'all' ? COLUMNS.map((c) => c.status) : [activeStatusTab];

  const activeCase = activeId
    ? Object.values(colItems).flat().find((c) => c.id === activeId) ?? null
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

    const activeCaseId = String(active.id);
    const overId = String(over.id);

    const validStatuses = new Set<string>(COLUMNS.map((c) => c.status));
    let overStatus: CaseStatus;
    if (validStatuses.has(overId)) {
      overStatus = overId as CaseStatus;
    } else {
      let resolved: CaseStatus | null = null;
      for (const [status, items] of Object.entries(colItems)) {
        if (items.some((c) => c.id === overId)) {
          resolved = status as CaseStatus;
          break;
        }
      }
      if (!resolved) return;
      overStatus = resolved;
    }

    let sourceStatus: CaseStatus | null = null;
    for (const [status, items] of Object.entries(colItems)) {
      if (items.some((c) => c.id === activeCaseId)) {
        sourceStatus = status as CaseStatus;
        break;
      }
    }
    if (!sourceStatus || sourceStatus === overStatus) return;

    const prevColItems = { ...colItems };
    setColItems((prev) => {
      const caseItem = prev[sourceStatus!].find((c) => c.id === activeCaseId);
      if (!caseItem) return prev;
      return {
        ...prev,
        [sourceStatus!]: prev[sourceStatus!].filter((c) => c.id !== activeCaseId),
        [overStatus]: [{ ...caseItem, status: overStatus }, ...(prev[overStatus] ?? [])],
      };
    });

    updateCase.mutate(
      { id: activeCaseId, data: { status: overStatus } },
      {
        onError: () => {
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
              <div
                className={`${col.headerBg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}
              >
                <span className="text-xs font-semibold text-white">{col.label}</span>
                <span className="text-xs font-medium text-white/80">{items.length}</span>
              </div>
              <SortableContext
                id={col.status}
                items={items.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
                  {items.map((caseItem) => (
                    <CasesKanbanCard key={caseItem.id} caseItem={caseItem} onClick={onCardClick} />
                  ))}
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
        {activeCase ? <CasesKanbanCardOverlay caseItem={activeCase} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
