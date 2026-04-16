import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginCallback } from '../../components/auth/LoginCallback'
import { AuthContext } from '../../contexts/AuthContext'

/**
 * Mock oidc-client-ts UserManager
 */
const mockSigninRedirectCallback = vi.fn()
const mockUserManager = {
  signinRedirectCallback: mockSigninRedirectCallback,
  getUser: vi.fn().mockResolvedValue(null),
  events: {
    addAccessTokenExpiring: vi.fn(),
    addUserLoaded: vi.fn(),
    addUserUnloaded: vi.fn(),
  },
}

vi.mock('oidc-client-ts', () => {
  return {
    UserManager: vi.fn(() => mockUserManager),
  }
})

/**
 * Mock API token setter
 */
vi.mock('../../lib/api', () => ({
  setTokenGetter: vi.fn(),
}))

describe('LoginCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set env vars to allow UserManager to be created
    import.meta.env.VITE_AUTHENTIK_ISSUER = 'http://localhost:8888/auth/application/o/ndt-portal/'
    import.meta.env.VITE_AUTHENTIK_CLIENT_ID = 'test-client-id'
  })

  it('should show "Processing login..." while isLoading is true', () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: true,
          accessToken: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: mockUserManager,
        }}
      >
        <MemoryRouter>
          <LoginCallback />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Processing login...')).toBeInTheDocument()
  })

  it('should call signinRedirectCallback when userManager is present', async () => {
    mockSigninRedirectCallback.mockResolvedValue(undefined)

    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: false,
          accessToken: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: mockUserManager,
        }}
      >
        <MemoryRouter>
          <LoginCallback />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await waitFor(() => {
      expect(mockSigninRedirectCallback).toHaveBeenCalled()
    })
  })

  it('should navigate to / on successful callback', async () => {
    mockSigninRedirectCallback.mockResolvedValue(undefined)

    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: false,
          accessToken: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: mockUserManager,
        }}
      >
        <MemoryRouter initialEntries={['/login/callback']}>
          <Routes>
            <Route path="/login/callback" element={<LoginCallback />} />
            <Route path="/" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should navigate to /login on callback error', async () => {
    mockSigninRedirectCallback.mockRejectedValue(new Error('OIDC error'))

    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: false,
          accessToken: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: mockUserManager,
        }}
      >
        <MemoryRouter initialEntries={['/login/callback']}>
          <Routes>
            <Route path="/login/callback" element={<LoginCallback />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should handle missing userManager gracefully', async () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: false,
          accessToken: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: null,
        }}
      >
        <MemoryRouter>
          <LoginCallback />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Should render "Redirecting..." without throwing
    expect(screen.getByText('Redirecting...')).toBeInTheDocument()
  })
})
