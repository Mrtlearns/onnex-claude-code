'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Assignment } from '@/lib/types'
import { CalendarIcon } from '@heroicons/react/24/outline'
import { CopilotChat } from '@/components/CopilotChat'

interface TaskQueueProps {
  assignments: Assignment[]
}

const ASSIGNMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unassigned: { label: 'Unassigned', color: 'bg-gray-100 text-gray-600' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  submitted: { label: 'Submitted', color: 'bg-yellow-100 text-yellow-700' },
  in_review: { label: 'In Review', color: 'bg-purple-100 text-purple-700' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
}

function isDueSoon(dueDateStr?: string): boolean {
  if (!dueDateStr) return false
  const daysUntil = (new Date(dueDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntil <= 7 && daysUntil >= 0
}

function isOverdue(dueDateStr?: string): boolean {
  if (!dueDateStr) return false
  return new Date(dueDateStr).getTime() < Date.now()
}

export function TaskQueue({ assignments }: TaskQueueProps) {
  const [openCopilotId, setOpenCopilotId] = useState<string | null>(null)
  const { data: session } = useSession()
  const token = (session?.user as any)?.accessToken as string | undefined

  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No tasks in queue</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map((assignment) => {
        const control = (assignment as any).program_control?.control_definition
        const programControl = (assignment as any).program_control
        const statusConfig =
          ASSIGNMENT_STATUS_CONFIG[assignment.status] || ASSIGNMENT_STATUS_CONFIG.unassigned
        const overdue = isOverdue(assignment.due_date)
        const dueSoon = isDueSoon(assignment.due_date)
        const hasCopilot = !!(assignment.program_id && programControl?.id)

        return (
          <div
            key={assignment.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {control?.nist_id || '—'}
                  </span>
                  <span className="text-xs text-gray-500">{control?.family_abbrev}</span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {control?.requirement_text
                    ? control.requirement_text.slice(0, 100) +
                      (control.requirement_text.length > 100 ? '…' : '')
                    : 'No description'}
                </p>
                {assignment.due_date && (
                  <div
                    className={`flex items-center gap-1 mt-2 text-xs ${
                      overdue
                        ? 'text-red-600'
                        : dueSoon
                        ? 'text-amber-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>
                      {overdue ? 'Overdue: ' : dueSoon ? 'Due soon: ' : 'Due: '}
                      {new Date(assignment.due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </span>
                <div className="flex items-center gap-2">
                  {programControl?.id && (
                    <Link
                      href={`controls/${programControl.id}`}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Upload Evidence
                    </Link>
                  )}
                  {hasCopilot && (
                    <button
                      onClick={() =>
                        setOpenCopilotId(
                          openCopilotId === assignment.id ? null : assignment.id
                        )
                      }
                      className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors whitespace-nowrap"
                    >
                      {openCopilotId === assignment.id ? 'Close' : '✦ Copilot'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasCopilot && openCopilotId === assignment.id && token && (
              <div className="border-t border-gray-100 pt-3 mt-3">
                <CopilotChat
                  programId={assignment.program_id}
                  controlId={programControl.id}
                  accessToken={token}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
