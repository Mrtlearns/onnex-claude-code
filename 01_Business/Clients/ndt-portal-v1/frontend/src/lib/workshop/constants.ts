import type { InspectionType, JobStatus, Priority } from './types'

export const INSPECTION_TYPES: InspectionType[] = ['RT', 'UT', 'ET', 'MT', 'PT', 'VT']

// 12-color palette for order linking — each orderId gets a deterministic color
// Colors are vivid and distinct enough to identify across machine rows at a glance
export const ORDER_PALETTE: string[] = [
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ef4444', // red-500 (only used when not a conflict card)
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
  '#e11d48', // rose-600
]

// Per-inspection-type badge colors (bg / text pairs)
export const INSPECTION_COLORS: Record<InspectionType, { bg: string; text: string }> = {
  RT: { bg: '#1e3a5f', text: '#60a5fa' },  // blue
  UT: { bg: '#1a3a1a', text: '#4ade80' },  // green
  ET: { bg: '#3b1f5e', text: '#c084fc' },  // purple
  MT: { bg: '#1f3b4a', text: '#38bdf8' },  // cyan
  PT: { bg: '#3a2a10', text: '#fbbf24' },  // amber
  VT: { bg: '#1a3330', text: '#2dd4bf' },  // teal
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  high:   '#ef4444',
  medium: '#f97316',
  low:    '#6b7280',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  unscheduled: '#6b7280',
  scheduled:   '#eab308',
  in_progress: '#f97316',
  completed:   '#22c55e',
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  unscheduled: 'Unscheduled',
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
}

export const INSPECTION_TYPE_ICONS: Record<InspectionType, string> = {
  RT: '📡',
  UT: '🔊',
  ET: '⚡',
  MT: '🧲',
  PT: '💧',
  VT: '👁',
}
