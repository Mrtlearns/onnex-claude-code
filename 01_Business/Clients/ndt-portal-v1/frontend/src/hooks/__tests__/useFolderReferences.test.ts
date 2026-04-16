import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFolderReferences } from '../useFolderReferences'
import type { FolderReference } from '@/lib/settingsApi'

// ── Mock AuthContext ──────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ accessToken: 'test-token' })),
}))

// ── Mock settingsApi ──────────────────────────────────────────

vi.mock('@/lib/settingsApi', () => ({
  settingsApi: {
    getFolderReferences: vi.fn(),
    createFolderReference: vi.fn(),
    updateFolderReference: vi.fn(),
    deleteFolderReference: vi.fn(),
  },
}))

import { settingsApi } from '@/lib/settingsApi'

const mockApi = settingsApi as unknown as {
  getFolderReferences: ReturnType<typeof vi.fn>
  createFolderReference: ReturnType<typeof vi.fn>
  updateFolderReference: ReturnType<typeof vi.fn>
  deleteFolderReference: ReturnType<typeof vi.fn>
}

const makeRef = (id: string, alias: string): FolderReference => ({
  id,
  alias,
  displayName: `Display ${alias}`,
  nextcloudPath: `/NDT/${alias}/`,
  description: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

// ── Tests ─────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getFolderReferences.mockResolvedValue([])
})

describe('useFolderReferences', () => {
  it('starts in loading state', () => {
    mockApi.getFolderReferences.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useFolderReferences())
    expect(result.current.loading).toBe(true)
    expect(result.current.refs).toEqual([])
  })

  it('loads refs on mount', async () => {
    const refs = [makeRef('r1', 'tech_spec'), makeRef('r2', 'drawings')]
    mockApi.getFolderReferences.mockResolvedValue(refs)

    const { result } = renderHook(() => useFolderReferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.refs).toHaveLength(2)
    expect(result.current.refs[0].alias).toBe('tech_spec')
    expect(result.current.error).toBeNull()
  })

  it('sets error state when load fails', async () => {
    mockApi.getFolderReferences.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useFolderReferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Failed to load folder references')
    expect(result.current.refs).toEqual([])
  })

  it('createRef appends new ref to list', async () => {
    const initial = [makeRef('r1', 'tech_spec')]
    mockApi.getFolderReferences.mockResolvedValue(initial)

    const created = makeRef('r2', 'new_folder')
    mockApi.createFolderReference.mockResolvedValue(created)

    const { result } = renderHook(() => useFolderReferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createRef({
        alias: 'new_folder',
        displayName: 'Display new_folder',
        nextcloudPath: '/NDT/new_folder/',
      })
    })

    expect(result.current.refs).toHaveLength(2)
    expect(result.current.refs[1].alias).toBe('new_folder')
  })

  it('updateRef replaces the matching ref in list', async () => {
    const initial = [makeRef('r1', 'tech_spec')]
    mockApi.getFolderReferences.mockResolvedValue(initial)

    const updated = { ...initial[0], displayName: 'Updated Name' }
    mockApi.updateFolderReference.mockResolvedValue(updated)

    const { result } = renderHook(() => useFolderReferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateRef('r1', { displayName: 'Updated Name' })
    })

    expect(result.current.refs[0].displayName).toBe('Updated Name')
    expect(result.current.refs).toHaveLength(1)
  })

  it('deleteRef removes the ref from list', async () => {
    const initial = [makeRef('r1', 'tech_spec'), makeRef('r2', 'drawings')]
    mockApi.getFolderReferences.mockResolvedValue(initial)
    mockApi.deleteFolderReference.mockResolvedValue(undefined)

    const { result } = renderHook(() => useFolderReferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteRef('r1')
    })

    expect(result.current.refs).toHaveLength(1)
    expect(result.current.refs[0].alias).toBe('drawings')
  })
})
