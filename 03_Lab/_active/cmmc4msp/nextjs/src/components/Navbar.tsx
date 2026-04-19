'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useQuery } from '@apollo/client'
import { GET_ORGS } from '@/graphql/queries'
import { ChevronDownIcon, ShieldCheckIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  msp_admin: 'bg-purple-100 text-purple-700',
  client_admin: 'bg-blue-100 text-blue-700',
  client_user: 'bg-green-100 text-green-700',
  contributor: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-600',
}

export function Navbar() {
  const { data: session } = useSession()
  const user = session?.user as any
  const canSeeAllClients = user?.role === 'super_admin' || user?.role === 'msp_admin'
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)

  const { data: orgsData } = useQuery(GET_ORGS, { skip: !canSeeAllClients })

  if (!session) {
    return (
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-gray-900">CMMC4MSP</span>
        </div>
      </nav>
    )
  }

  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.viewer

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-gray-900">CMMC4MSP</span>
        </Link>
        {canSeeAllClients && (
          <div className="relative">
            <button
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1"
              onClick={() => setOrgMenuOpen((v) => !v)}
            >
              Switch Client
              <ChevronDownIcon className="w-3 h-3" />
            </button>
            {orgMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                {(orgsData?.orgs || []).map((org: any) => (
                  <Link
                    key={org.id}
                    href={`/${org.slug}/dashboard`}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setOrgMenuOpen(false)}
                  >
                    {org.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {user?.role === 'super_admin' && (
          <Link
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1"
          >
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{user?.email}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>
          {user?.role?.replace('_', ' ')}
        </span>
        <button
          onClick={async () => {
            // Clear NextAuth session, then end the Authentik OIDC session so
            // the provider doesn't silently re-authenticate on the next visit.
            await signOut({ redirect: false })
            const issuer = (process.env.NEXT_PUBLIC_AUTHENTIK_ISSUER || '').replace(/\/$/, '')
            const hint = (user as any)?.accessToken ?? ''
            const returnTo = encodeURIComponent(window.location.origin + '/')
            window.location.href = hint
              ? `${issuer}/end-session/?id_token_hint=${hint}&post_logout_redirect_uri=${returnTo}`
              : `${issuer}/end-session/?post_logout_redirect_uri=${returnTo}`
          }}
          className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
