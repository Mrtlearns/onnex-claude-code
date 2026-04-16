export type NodeStatus = 'fresh' | 'aging' | 'urgent' | 'catchall'

export const STATUS_COLORS: Record<NodeStatus, string> = {
  fresh: '#4ade80',
  aging: '#facc15',
  urgent: '#f97316',
  catchall: '#94a3b8',
}

export const STATUS_GLOW: Record<NodeStatus, string> = {
  fresh: '0 0 20px 5px #4ade80',
  aging: '0 0 20px 5px #facc15',
  urgent: '0 0 20px 5px #f97316',
  catchall: '0 0 8px 2px #94a3b8',
}

export function computeStatus(lastAccessedAt: Date): NodeStatus {
  const now = Date.now()
  const lastAccessed = new Date(lastAccessedAt).getTime()
  const diffDays = (now - lastAccessed) / (1000 * 60 * 60 * 24)

  if (diffDays < 7) return 'fresh'
  if (diffDays < 30) return 'aging'
  if (diffDays < 90) return 'urgent'
  return 'catchall'
}

export function getStatusColor(status: NodeStatus): string {
  return STATUS_COLORS[status]
}

export function getStatusGlow(status: NodeStatus): string {
  return STATUS_GLOW[status]
}

export const STATUS_LABELS: Record<NodeStatus, string> = {
  fresh: 'Fresh',
  aging: 'Aging',
  urgent: 'Urgent',
  catchall: 'Catch-all',
}
