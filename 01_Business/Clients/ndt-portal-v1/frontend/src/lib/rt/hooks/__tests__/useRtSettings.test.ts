/**
 * Tests for the accessToken guard pattern in RT data hooks.
 * Verifies hooks don't fetch without a token and do fetch when token is available.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

// Mock the auth context
const mockUseAuth = vi.fn()
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock the API module
const mockSingleton = vi.fn()
const mockList = vi.fn()
vi.mock('@/lib/api', () => ({
  rtApi: {
    singleton: (...args: unknown[]) => mockSingleton(...args),
    list: (...args: unknown[]) => mockList(...args),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}))

// Import hooks AFTER mocks are set up
import { useRtSettings } from '../useRtSettings'
import { useRtOperators } from '../useRtOperators'
import { useRtFilmSizes } from '../useRtFilmSizes'
import { useRtPricingTiers } from '../useRtPricingTiers'
import { useRtQuotes } from '../useRtQuote'

beforeEach(() => {
  vi.clearAllMocks()
  mockSingleton.mockReset()
  mockList.mockReset()
})

describe('useRtSettings — accessToken guard', () => {
  it('does NOT fetch when accessToken is null', () => {
    mockUseAuth.mockReturnValue({ accessToken: null })
    mockSingleton.mockResolvedValue({ id: '1' })

    renderHook(() => useRtSettings())

    expect(mockSingleton).not.toHaveBeenCalled()
  })

  it('fetches when accessToken is available', async () => {
    mockUseAuth.mockReturnValue({ accessToken: 'test-token-123' })
    mockSingleton.mockResolvedValue({ id: '1', burdenMultiplier: 1.16 })

    const { result } = renderHook(() => useRtSettings())

    expect(mockSingleton).toHaveBeenCalledWith('settings')
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.settings).toEqual({ id: '1', burdenMultiplier: 1.16 })
    })
  })

  it('re-fetches when accessToken changes from null to a value', async () => {
    // Start with no token
    mockUseAuth.mockReturnValue({ accessToken: null })
    const { result, rerender } = renderHook(() => useRtSettings())

    expect(mockSingleton).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)

    // Token becomes available
    mockUseAuth.mockReturnValue({ accessToken: 'new-token' })
    mockSingleton.mockResolvedValue({ id: '1', burdenMultiplier: 1.16 })
    rerender()

    await waitFor(() => {
      expect(mockSingleton).toHaveBeenCalledTimes(1)
      expect(result.current.loading).toBe(false)
    })
  })
})

describe('useRtOperators — accessToken guard', () => {
  it('does NOT fetch when accessToken is null', () => {
    mockUseAuth.mockReturnValue({ accessToken: null })
    renderHook(() => useRtOperators())
    expect(mockList).not.toHaveBeenCalled()
  })

  it('fetches when accessToken is available', async () => {
    mockUseAuth.mockReturnValue({ accessToken: 'tok' })
    mockList.mockResolvedValue([{ id: '1', name: 'Op1' }])

    const { result } = renderHook(() => useRtOperators())

    expect(mockList).toHaveBeenCalledWith('operators', { order: 'sort_order' })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.operators).toHaveLength(1)
    })
  })
})

describe('useRtFilmSizes — accessToken guard', () => {
  it('does NOT fetch when accessToken is null', () => {
    mockUseAuth.mockReturnValue({ accessToken: null })
    renderHook(() => useRtFilmSizes())
    expect(mockList).not.toHaveBeenCalled()
  })

  it('fetches when accessToken is available', async () => {
    mockUseAuth.mockReturnValue({ accessToken: 'tok' })
    mockList.mockResolvedValue([{ id: '1', label: '5X7' }])

    const { result } = renderHook(() => useRtFilmSizes())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.filmSizes).toHaveLength(1)
    })
  })
})

describe('useRtPricingTiers — accessToken guard', () => {
  it('does NOT fetch when accessToken is null', () => {
    mockUseAuth.mockReturnValue({ accessToken: null })
    renderHook(() => useRtPricingTiers())
    expect(mockList).not.toHaveBeenCalled()
  })

  it('fetches when accessToken is available', async () => {
    mockUseAuth.mockReturnValue({ accessToken: 'tok' })
    mockList.mockResolvedValue([{ id: '1', label: '$0.085' }])

    const { result } = renderHook(() => useRtPricingTiers())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.tiers).toHaveLength(1)
    })
  })
})

describe('useRtQuotes — accessToken guard', () => {
  it('does NOT fetch when accessToken is null', () => {
    mockUseAuth.mockReturnValue({ accessToken: null })
    renderHook(() => useRtQuotes())
    expect(mockList).not.toHaveBeenCalled()
  })

  it('fetches when accessToken is available', async () => {
    mockUseAuth.mockReturnValue({ accessToken: 'tok' })
    mockList.mockResolvedValue([{ id: '1', partNumber: 'P001' }])

    const { result } = renderHook(() => useRtQuotes())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.quotes).toHaveLength(1)
    })
  })
})
