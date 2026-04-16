import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { WorkshopSettings } from '@/lib/workshop/types'
import { workshopApi } from '@/lib/workshop/workshopApi'

const DEFAULT_SETTINGS: WorkshopSettings = {
  businessHours: { start: '08:00', end: '17:00', timezone: 'America/Los_Angeles' },
  inspectionTypes: ['RT', 'UT', 'ET', 'MT', 'PT', 'VT'],
  inspectionDurationsDefault: { RT: 60, UT: 60, ET: 60, MT: 60, PT: 60, VT: 60 },
  machineCounts: { RT: 2, UT: 1, ET: 1, MT: 1, PT: 1, VT: 1 },
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  holidays: [],
  bufferMinutes: 0,
}

interface UseWorkshopSettingsResult {
  settings: WorkshopSettings
  loading: boolean
  updateSetting: (key: string, value: unknown) => Promise<void>
}

export function useWorkshopSettings(): UseWorkshopSettingsResult {
  const { accessToken } = useAuth()
  const [settings, setSettings] = useState<WorkshopSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    workshopApi.getSettings()
      .then((s) => { setSettings(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [accessToken])

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    await workshopApi.updateSetting(key, value)
    setSettings((prev) => ({ ...prev, [toCamelKey(key)]: value }))
  }, [])

  return { settings, loading, updateSetting }
}

function toCamelKey(snakeKey: string): string {
  return snakeKey.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}
