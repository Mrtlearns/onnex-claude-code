'use client'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import { GET_MY_ASSIGNMENTS } from '@/graphql/queries'
import { TaskQueue } from '@/components/TaskQueue'
import { Assignment } from '@/lib/types'

interface TasksPageProps {
  params: { orgSlug: string }
}

const TABS = [
  { value: '', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'accepted', label: 'Accepted' },
]

export default function TasksPage({ params }: TasksPageProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const userId = user?.id
  const [activeTab, setActiveTab] = useState('')

  const { data, loading } = useQuery(GET_MY_ASSIGNMENTS, {
    variables: { userId },
    skip: !userId,
  })

  const allAssignments: Assignment[] = data?.assignments || []

  const filtered =
    activeTab === ''
      ? allAssignments
      : allAssignments.filter((a) => a.status === activeTab)

  const countFor = (status: string) =>
    status === '' ? allAssignments.length : allAssignments.filter((a) => a.status === status).length

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 w-20 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Tasks</h1>
        <span className="text-sm text-gray-500">{filtered.length} tasks</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.value
                ? 'text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.value ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              {countFor(tab.value)}
            </span>
          </button>
        ))}
      </div>

      <TaskQueue assignments={filtered} />
    </div>
  )
}
