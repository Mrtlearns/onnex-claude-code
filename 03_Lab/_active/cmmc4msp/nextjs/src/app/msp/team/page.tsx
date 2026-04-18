'use client'
import { useQuery } from '@apollo/client'
import { useSession } from 'next-auth/react'
import { GET_ADMIN_USERS } from '@/graphql/queries'

const ROLE_COLORS: Record<string, string> = {
  msp_admin:    'bg-blue-100 text-blue-700',
  client_admin: 'bg-emerald-100 text-emerald-700',
  client_user:  'bg-gray-100 text-gray-600',
}

export default function MspTeam() {
  const { data: session } = useSession()
  const { data, loading } = useQuery(GET_ADMIN_USERS, { skip: !session })

  // Filter to MSP-level users only
  const users = (data?.users ?? []).filter(
    (u: any) => u.role === 'msp_admin' || u.msp?.id
  )

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">MSP Team</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} MSP team members</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No MSP team members found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {u.full_name || '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.role?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
