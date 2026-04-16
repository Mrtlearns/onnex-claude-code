'use client'
import { useSubscription } from '@apollo/client'
import { SUBSCRIBE_ACTIVITY_FEED } from '@/graphql/subscriptions'
import {
  ShieldCheckIcon,
  DocumentArrowUpIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface ActivityFeedProps {
  orgId: string
}

function getEventIcon(eventType: string) {
  if (eventType.includes('artifact') || eventType.includes('upload'))
    return <DocumentArrowUpIcon className="w-4 h-4 text-blue-500" />
  if (eventType.includes('assignment') || eventType.includes('user'))
    return <UserPlusIcon className="w-4 h-4 text-purple-500" />
  if (eventType.includes('complete') || eventType.includes('implemented'))
    return <CheckCircleIcon className="w-4 h-4 text-green-500" />
  if (eventType.includes('fail') || eventType.includes('reject'))
    return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
  if (eventType.includes('assess'))
    return <ShieldCheckIcon className="w-4 h-4 text-indigo-500" />
  return <ClockIcon className="w-4 h-4 text-gray-400" />
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ActivityFeed({ orgId }: ActivityFeedProps) {
  const { data, loading } = useSubscription(SUBSCRIBE_ACTIVITY_FEED, {
    variables: { orgId },
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const entries = data?.activity_log || []

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
    )
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {entries.map((entry: any) => (
        <div key={entry.id} className="flex gap-3 items-start">
          <div className="mt-0.5 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
            {getEventIcon(entry.event_type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 leading-snug">{entry.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {entry.user && (
                <span className="text-xs text-gray-400">{entry.user.full_name || entry.user.email}</span>
              )}
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{timeAgo(entry.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
