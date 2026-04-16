import { NodeStatus, STATUS_LABELS } from '@/lib/aging'

interface StatusBadgeProps {
  status: NodeStatus
  className?: string
}

const statusStyles: Record<NodeStatus, string> = {
  fresh: 'bg-green-400/20 text-green-400 border-green-400/30',
  aging: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
  urgent: 'bg-orange-400/20 text-orange-400 border-orange-400/30',
  catchall: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
        ${statusStyles[status]}
        ${className}
      `}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block"
        style={{
          backgroundColor: {
            fresh: '#4ade80',
            aging: '#facc15',
            urgent: '#f97316',
            catchall: '#94a3b8',
          }[status],
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  )
}
