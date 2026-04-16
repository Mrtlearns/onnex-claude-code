import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from '../../components/auth/RequireAuth'
import { AuthContext } from '../../contexts/AuthContext'
import React from 'react'

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

describe('RequireAuth', () => {
  it('should show Loading when isLoading is true', () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          isLoading: true,
          accessToken: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: null,
        }}
      >
        <MemoryRouter>
          <RequireAuth>
            <div>Protected Content</div>
          </RequireAuth>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should redirect to /login when user is null and isLoading is false', () => {
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
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>Protected Content</div>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    // Navigate should happen, check for login page
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('should render children when user is present and isLoading is false', () => {
    const mockUser = {
      sub: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      tenant_id: 'test-tenant',
      permissions: [],
    }

    render(
      <AuthContext.Provider
        value={{
          user: mockUser,
          isLoading: false,
          accessToken: 'token',
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn(() => false),
          userManager: null,
        }}
      >
        <MemoryRouter>
          <RequireAuth>
            <div>Protected Content</div>
          </RequireAuth>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
