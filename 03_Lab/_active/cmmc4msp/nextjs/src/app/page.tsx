'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { GET_ORGS } from '@/graphql/queries'

export default function RootPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const user = session?.user as any

  // For client roles, fetch their org to get the slug
  const needsOrg = user?.role === 'client_admin' || user?.role === 'client_user'
  const { data: orgsData } = useQuery(GET_ORGS, { skip: !needsOrg })

  useEffect(() => {
    if (status !== 'authenticated') return

    const role = user?.role
    if (role === 'super_admin') {
      router.replace('/platform')
    } else if (role === 'msp_admin') {
      router.replace('/msp')
    } else if (needsOrg) {
      const firstOrg = orgsData?.orgs?.[0]
      if (firstOrg?.slug) {
        router.replace(`/${firstOrg.slug}/dashboard`)
      }
    }
  }, [status, user?.role, orgsData, needsOrg, router])

  if (status === 'loading' || (status === 'authenticated' && needsOrg && !orgsData)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <ShieldCheckIcon className="w-6 h-6 animate-pulse text-blue-500" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShieldCheckIcon className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">CMMC Compliance OS</h1>
          <p className="text-gray-500 mb-6">CMMC Level 2 Compliance Management Platform</p>
          <a
            href="/api/auth/signin"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  // Authenticated but org not resolved yet
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <ShieldCheckIcon className="w-6 h-6 animate-pulse text-blue-500" />
        <span className="text-sm">Redirecting…</span>
      </div>
    </div>
  )
}
