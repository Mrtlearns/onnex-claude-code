'use client'
import { useEffect, useState } from 'react'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

type ComponentStatus = 'up' | 'degraded' | 'down' | 'loading'

const ICON: Record<ComponentStatus, React.ReactNode> = {
  up:       <CheckCircleIcon className="w-5 h-5 text-emerald-500" />,
  degraded: <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />,
  down:     <XCircleIcon className="w-5 h-5 text-red-500" />,
  loading:  <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />,
}

const LABEL: Record<ComponentStatus, string> = {
  up: 'Operational', degraded: 'Degraded', down: 'Down', loading: 'Checking…',
}

export default function PlatformHealth() {
  const [health, setHealth] = useState<Record<string, ComponentStatus>>({
    postgres: 'loading', minio: 'loading', redis: 'loading', n8n: 'loading', openrouter: 'loading',
  })
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.cmmc4msp.on-nex.us'

  async function fetchHealth() {
    try {
      const r = await fetch(`${API_URL}/health/deep`)
      const body = await r.json()
      const components = body.components ?? {}
      setHealth(Object.fromEntries(
        Object.entries(components).map(([k, v]) => [k, v as ComponentStatus])
      ))
    } catch {
      setHealth((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, 'down'])))
    }
    setLastChecked(new Date())
  }

  useEffect(() => {
    fetchHealth()
    const id = setInterval(fetchHealth, 30_000)
    return () => clearInterval(id)
  }, [])

  const overallOk = Object.values(health).every((s) => s === 'up')
  const anyDown   = Object.values(health).some((s) => s === 'down')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking…'}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
          overallOk ? 'bg-emerald-100 text-emerald-700' :
          anyDown   ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
        }`}>
          {overallOk ? 'All Systems Operational' : anyDown ? 'Partial Outage' : 'Degraded'}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {Object.entries(health).map(([component, status], i) => (
          <div
            key={component}
            className={`flex items-center justify-between px-6 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}
          >
            <div className="flex items-center gap-3">
              {ICON[status]}
              <span className="font-medium text-gray-800 capitalize">{component}</span>
            </div>
            <span className={`text-sm ${
              status === 'up'       ? 'text-emerald-600' :
              status === 'down'     ? 'text-red-600' :
              status === 'loading'  ? 'text-gray-400' :
                                      'text-amber-600'
            }`}>
              {LABEL[status]}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Auto-refreshes every 30 seconds. Do not share this URL publicly.
      </p>
    </div>
  )
}
