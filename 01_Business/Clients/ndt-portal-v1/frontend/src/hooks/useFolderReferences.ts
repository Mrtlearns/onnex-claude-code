import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { settingsApi, type FolderReference } from '@/lib/settingsApi'

export function useFolderReferences() {
  const { accessToken } = useAuth()
  const [refs, setRefs] = useState<FolderReference[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await settingsApi.getFolderReferences()
      setRefs(data)
      setError(null)
    } catch {
      setError('Failed to load folder references')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (accessToken) void load() }, [load, accessToken])

  const createRef = useCallback(async (data: {
    alias: string
    displayName: string
    nextcloudPath: string
    description?: string
  }) => {
    const created = await settingsApi.createFolderReference(data)
    setRefs(prev => [...prev, created])
    return created
  }, [])

  const updateRef = useCallback(async (id: string, data: Partial<{
    alias: string
    displayName: string
    nextcloudPath: string
    description: string
    isActive: boolean
  }>) => {
    const updated = await settingsApi.updateFolderReference(id, data)
    setRefs(prev => prev.map(r => r.id === id ? updated : r))
    return updated
  }, [])

  const deleteRef = useCallback(async (id: string) => {
    await settingsApi.deleteFolderReference(id)
    setRefs(prev => prev.filter(r => r.id !== id))
  }, [])

  return { refs, loading, error, refetch: load, createRef, updateRef, deleteRef }
}
