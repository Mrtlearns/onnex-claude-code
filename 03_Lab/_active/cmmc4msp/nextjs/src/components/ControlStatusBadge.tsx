'use client'
import { CONTROL_STATUS_CONFIG } from '@/lib/constants'
import { ControlStatus } from '@/lib/types'

export function ControlStatusBadge({
  status,
  size = 'md',
}: {
  status: ControlStatus
  size?: 'sm' | 'md'
}) {
  const config = CONTROL_STATUS_CONFIG[status] || CONTROL_STATUS_CONFIG.not_yet_assessed
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClass}`}
    >
      {config.label}
    </span>
  )
}
