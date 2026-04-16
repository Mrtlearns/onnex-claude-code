import { useState, useEffect, useRef } from 'react'
import type { WorkshopOrder } from '@/lib/workshop/types'
import { getAuthHeaders } from '@/lib/api'

interface UseWorkshopOrdersResult {
  orders: WorkshopOrder[]
  connected: boolean
  error: string | null
}

export function useWorkshopOrders(): UseWorkshopOrdersResult {
  const [orders, setOrders] = useState<WorkshopOrder[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0

    function connect() {
      // EventSource cannot set headers — pass JWT as query param for server-side validation
      const authHeader = getAuthHeaders()['Authorization'] ?? ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      const sseUrl = token ? `/api/workshop/sse?token=${encodeURIComponent(token)}` : '/api/workshop/sse'
      const es = new EventSource(sseUrl)
      esRef.current = es

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          setOrders(JSON.parse(e.data) as WorkshopOrder[])
          setConnected(true)
          setError(null)
          attempts = 0
        } catch {
          setError('Failed to parse initial data')
        }
      })

      es.addEventListener('update', (e: MessageEvent) => {
        try {
          setOrders(JSON.parse(e.data) as WorkshopOrder[])
        } catch {
          // ignore parse errors on incremental updates
        }
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Exponential backoff: 1s, 2s, 4s, max 10s
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000)
        attempts++
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      esRef.current?.close()
    }
  }, [])

  return { orders, connected, error }
}
