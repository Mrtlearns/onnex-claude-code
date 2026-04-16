import { useState, useCallback } from 'react'
import { workshopApi } from '@/lib/workshop/workshopApi'
import type { ScheduleJobPayload } from '@/lib/workshop/types'

interface UseScheduleJobResult {
  scheduleJob: (jobId: string, payload: ScheduleJobPayload) => Promise<void>
  scheduling: boolean
  error: string | null
}

export function useScheduleJob(): UseScheduleJobResult {
  const [scheduling, setScheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scheduleJob = useCallback(async (jobId: string, payload: ScheduleJobPayload) => {
    setScheduling(true)
    setError(null)
    try {
      await workshopApi.scheduleJob(jobId, payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schedule failed')
      throw e
    } finally {
      setScheduling(false)
    }
  }, [])

  return { scheduleJob, scheduling, error }
}
