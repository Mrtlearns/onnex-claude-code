import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../contexts/AuthContext'

/**
 * Mock oidc-client-ts UserManager
 */
vi.mock('oidc-client-ts', () => {
  return {
    UserManager: vi.fn(() => ({
      getUser: vi.fn().mockResolvedValue(null),
      events: {
        addAccessTokenExpiring: vi.fn(),
        addUserLoaded: vi.fn(),
        addUserUnloaded: vi.fn(),
      },
    })),
  }
})

/**
 * Mock API token setter
 */
vi.mock('../../lib/api', () => ({
  setTokenGetter: vi.fn(),
}))

/**
 * Test component that accesses auth context
 */
function TestComponent() {
  const { user, userManager, isLoading, login, logout, hasPermission } = useAuth()
  return (
    <div>
      <div data-testid="is-loading">{isLoading ? 'loading' : 'done'}</div>
      <div data-testid="user">{user ? 'logged-in' : 'logged-out'}</div>
      <div data-testid="user-manager">{userManager ? 'manager-exists' : 'manager-null'}</div>
      <button onClick={() => login()}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <div data-testid="has-permission">{hasPermission('RT_INSPECTION') ? 'yes' : 'no'}</div>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear all env vars before each test
    import.meta.env.VITE_AUTHENTIK_ISSUER = ''
    import.meta.env.VITE_AUTHENTIK_CLIENT_ID = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should set isLoading to false when both env vars are missing', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Should eventually resolve to done (isLoading = false)
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('done')
    }, { timeout: 2000 })
  })

  it('should set isLoading to false when only VITE_AUTHENTIK_CLIENT_ID is missing', async () => {
    import.meta.env.VITE_AUTHENTIK_ISSUER = 'http://localhost:8888/auth/application/o/ndt-portal/'

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('done')
    }, { timeout: 2000 })
  })

  it('should set userManager to null when env vars are missing', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-manager')).toHaveTextContent('manager-null')
    }, { timeout: 2000 })
  })

  it('should not throw when login is called with null userManager', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-manager')).toHaveTextContent('manager-null')
    }, { timeout: 2000 })

    const loginButton = screen.getByRole('button', { name: /login/i })
    expect(() => loginButton.click()).not.toThrow()
  })

  it('should not throw when logout is called with null userManager', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-manager')).toHaveTextContent('manager-null')
    }, { timeout: 2000 })

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    expect(() => logoutButton.click()).not.toThrow()
  })

  it('should return false for hasPermission when user is null', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-permission')).toHaveTextContent('no')
    }, { timeout: 2000 })
  })

  it('should render user as logged-out when user is null', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-out')
    }, { timeout: 2000 })
  })
})
