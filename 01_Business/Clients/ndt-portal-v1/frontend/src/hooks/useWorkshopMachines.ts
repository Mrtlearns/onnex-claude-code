import { useState, useEffect, useCallback } from 'react'
import type { WorkshopMachine } from '@/lib/workshop/types'
import { getAuthHeaders } from '@/lib/api'

const BASE = '/api/workshop'

interface UseWorkshopMachinesResult {
  machines: WorkshopMachine[]
  loading: boolean
  refetch: () => void
  createMachine: (data: { name: string; type: string; inspectorName?: string | null; displayOrder?: number }) => Promise<WorkshopMachine>
  updateMachine: (id: string, data: { name?: string; inspectorName?: string | null; displayOrder?: number; isActive?: boolean }) => Promise<void>
  deleteMachine: (id: string) => Promise<void>
  addOfflineWindow: (machineId: string, data: { startAt: string; endAt: string; reason?: string | null }) => Promise<void>
  removeOfflineWindow: (machineId: string, windowId: string) => Promise<void>
}

export function useWorkshopMachines(): UseWorkshopMachinesResult {
  const [machines, setMachines] = useState<WorkshopMachine[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
    setLoading(true)
    fetch(`${BASE}/machines`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => { setMachines(data as WorkshopMachine[]); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tick])

  const createMachine = useCallback(async (data: {
    name: string; type: string; inspectorName?: string | null; displayOrder?: number
  }): Promise<WorkshopMachine> => {
    const res = await fetch(`${BASE}/machines`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    const machine = await res.json() as WorkshopMachine
    refetch()
    return machine
  }, [refetch])

  const updateMachine = useCallback(async (id: string, data: {
    name?: string; inspectorName?: string | null; displayOrder?: number; isActive?: boolean
  }): Promise<void> => {
    const res = await fetch(`${BASE}/machines/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    refetch()
  }, [refetch])

  const deleteMachine = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/machines/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
    if (!res.ok) throw new Error(await res.text())
    refetch()
  }, [refetch])

  const addOfflineWindow = useCallback(async (
    machineId: string,
    data: { startAt: string; endAt: string; reason?: string | null }
  ): Promise<void> => {
    const res = await fetch(`${BASE}/machines/${machineId}/offline`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    refetch()
  }, [refetch])

  const removeOfflineWindow = useCallback(async (
    machineId: string, windowId: string
  ): Promise<void> => {
    const res = await fetch(`${BASE}/machines/${machineId}/offline/${windowId}`, { method: 'DELETE', headers: getAuthHeaders() })
    if (!res.ok) throw new Error(await res.text())
    refetch()
  }, [refetch])

  return { machines, loading, refetch, createMachine, updateMachine, deleteMachine, addOfflineWindow, removeOfflineWindow }
}
