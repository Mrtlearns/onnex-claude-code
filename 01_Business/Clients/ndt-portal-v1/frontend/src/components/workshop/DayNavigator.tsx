import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import { cn } from '@/lib/utils'

interface DayNavigatorProps {
  selectedDate: Dayjs
  onChange: (date: Dayjs) => void
}

export function DayNavigator({ selectedDate, onChange }: DayNavigatorProps) {
  const isToday = selectedDate.isSame(dayjs(), 'day')

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(selectedDate.subtract(1, 'day'))}
        className="p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
        title="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="text-xs text-[var(--ws-text-muted)] min-w-[160px] text-center">
        {selectedDate.format('dddd, MMMM D')}
      </span>

      <button
        onClick={() => onChange(selectedDate.add(1, 'day'))}
        className="p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
        title="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isToday && (
        <button
          onClick={() => onChange(dayjs())}
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1 transition-colors',
            'bg-[var(--ws-accent)]/15 text-[var(--ws-accent)] hover:bg-[var(--ws-accent)]/25'
          )}
        >
          Today
        </button>
      )}
    </div>
  )
}
