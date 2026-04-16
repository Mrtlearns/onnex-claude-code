'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { GET_ADMIN_ORGS, GET_ADMIN_USERS, GET_ADMIN_MSPS } from '@/graphql/queries'
import { getSPRSColor } from '@/lib/constants'
import {
  BuildingOfficeIcon,
  UsersIcon,
  ServerStackIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

export default function AdminPage() {
  const { data: session } = useSession()
  const user = session?.user as any

  const { data: orgsData, loading: orgsLoading } = useQuery(GET_ADMIN_ORGS)
  const { data: usersData, loading: usersLoading } = useQuery(GET_ADMIN_USERS)
  const { data: mspsData, loading: mspsLoading } = useQuery(GET_ADMIN_MSPS)

  if (user?.role !== 'super_admin') {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 text-center text-gray-500">
        Admin access requires super_admin role.
      </div>
    )
  }

  const orgs = orgsData?.orgs || []
  const users = usersData?.users || []
  const msps = mspsData?.msps || []

  const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-700',
    msp_admin: 'bg-purple-100 text-purple-700',
    client_admin: 'bg-blue-100 text-blue-700',
    client_user: 'bg-green-100 text-green-700',
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Console</h1>
        <p className="text-sm text-gray-500 mt-1">Super admin — full platform visibility</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
          <BuildingOfficeIcon className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500">Client Orgs</p>
            <p className="text-3xl font-bold text-gray-900">{orgsLoading ? '…' : orgs.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
          <UsersIcon className="w-8 h-8 text-purple-500" />
          <div>
            <p className="text-sm text-gray-500">Users</p>
            <p className="text-3xl font-bold text-gray-900">{usersLoading ? '…' : users.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
          <ServerStackIcon className="w-8 h-8 text-green-500" />
          <div>
            <p className="text-sm text-gray-500">MSPs</p>
            <p className="text-3xl font-bold text-gray-900">{mspsLoading ? '…' : msps.length}</p>
          </div>
        </div>
      </div>

      {/* MSPs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">MSPs</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Orgs</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Users</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mspsLoading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
              ) : msps.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No MSPs yet</td></tr>
              ) : (
                msps.map((msp: any) => (
                  <tr key={msp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{msp.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{msp.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        msp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{msp.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{msp.orgs_aggregate?.aggregate?.count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{msp.users_aggregate?.aggregate?.count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(msp.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* All Orgs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">All Client Orgs</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">MSP</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">SPRS</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phase</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orgsLoading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
              ) : (
                orgs.map((org: any) => {
                  const prog = org.programs?.[0]
                  const sprs = prog?.sprs_score ?? 0
                  return (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/${org.slug}/dashboard`} className="font-medium text-blue-700 hover:underline">
                          {org.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{org.msp?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getSPRSColor(sprs)}`}>{sprs}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{prog ? `P${prog.current_phase}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>{org.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(org.created_at).toLocaleDateString()}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">All Users</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Org</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">MSP</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usersLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No users in DB yet</td></tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{u.email}</td>
                    <td className="px-4 py-3 text-gray-700">{u.full_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.org ? (
                        <Link href={`/${u.org.slug}/dashboard`} className="text-blue-600 hover:underline text-xs">
                          {u.org.name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.msp?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
