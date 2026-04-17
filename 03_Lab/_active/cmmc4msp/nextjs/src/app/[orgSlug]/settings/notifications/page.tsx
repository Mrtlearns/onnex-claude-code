'use client'
import { useState, useEffect } from 'react'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useSession } from 'next-auth/react'

interface NotificationPageProps {
  params: { orgSlug: string }
}

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  invite: {
    label: 'Invitations',
    description: 'When you invite someone or are invited to an organization',
  },
  assignment: {
    label: 'Assignments',
    description: 'When a control is assigned to you or your assignment status changes',
  },
  assessment_complete: {
    label: 'Assessment Complete',
    description: 'When Claude finishes assessing an artifact you uploaded',
  },
  poam_deadline: {
    label: 'POA&M Deadlines',
    description: 'Reminders 14, 7, and 1 day before a control target completion date',
  },
  phase_unlock: {
    label: 'Phase Unlocks',
    description: 'When a new compliance phase becomes available for your organization',
  },
  weekly_digest: {
    label: 'Weekly Digest',
    description: 'Monday morning summary of SPRS changes and program activity',
  },
}

export default function NotificationsPage({ params }: NotificationPageProps) {
  const { orgSlug } = params
  const { data: session } = useSession()
  const [preferences, setPreferences] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  async function fetchPreferences() {
    try {
      const res = await fetch('/api/notifications/preferences', {
        headers: { Authorization: `Bearer ${(session as any)?.accessToken || ''}` },
      })
      if (!res.ok) throw new Error('Failed to load preferences')
      const data = await res.json()
      setPreferences(data.preferences)
    } catch {
      setError('Could not load notification preferences.')
    } finally {
      setLoading(false)
    }
  }

  async function toggleCategory(category: string, newValue: boolean) {
    setSaving(category)
    setError(null)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(session as any)?.accessToken || ''}`,
        },
        body: JSON.stringify({ preferences: { [category]: newValue } }),
      })
      if (!res.ok) throw new Error('Save failed')
      setPreferences((prev) => ({ ...prev, [category]: newValue }))
      setSaved(category)
      setTimeout(() => setSaved(null), 2000)
    } catch {
      setError('Failed to save preference. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <BellIcon className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Control which emails you receive from CMMC Compliance OS.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading preferences…</div>
        ) : (
          Object.entries(CATEGORY_LABELS).map(([category, { label, description }]) => {
            const enabled = preferences[category] ?? true
            const isSaving = saving === category
            const isSaved = saved === category

            return (
              <div key={category} className="flex items-center justify-between p-4 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory(category, !enabled)}
                  disabled={isSaving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Toggle ${label}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                {isSaved && (
                  <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="text-xs text-gray-400">
        You can also unsubscribe from all emails using the link in the footer of any email we send.
      </p>
    </div>
  )
}
