import type { WorkshopGroup } from '@/lib/workshop/timelineUtils'
import { INSPECTION_TYPE_ICONS } from '@/lib/workshop/constants'
import type { InspectionType } from '@/lib/workshop/types'

export interface TimelineGroupRendererProps {
  group: WorkshopGroup
  jobCounts: Record<string, number>
}

export function TimelineGroupRenderer({ group, jobCounts }: TimelineGroupRendererProps) {
  const icon = INSPECTION_TYPE_ICONS[group.baseType as InspectionType]
  const count = jobCounts[group.id] ?? 0

  return (
    <div className="flex items-center justify-between px-2 h-full">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm shrink-0">{icon}</span>
        <div className="flex flex-col min-w-0">
          <span className="font-mono font-bold text-[11px] text-[var(--ws-text-primary)] truncate leading-tight">
            {group.title}
          </span>
          {group.inspectorName && (
            <span className="text-[9px] text-[var(--ws-text-muted)] truncate leading-tight">
              {group.inspectorName}
            </span>
          )}
        </div>
      </div>
      {count > 0 && (
        <span className="text-[10px] font-semibold text-[var(--ws-text-muted)] bg-[var(--ws-bg-tertiary)] px-1.5 py-0.5 rounded-full shrink-0 ml-1">
          {count}
        </span>
      )}
    </div>
  )
}
