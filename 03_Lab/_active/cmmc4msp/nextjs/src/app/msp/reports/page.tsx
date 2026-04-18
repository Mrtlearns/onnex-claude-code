'use client'
import { useSession } from 'next-auth/react'
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline'

export default function MspReports() {
  const { data: session } = useSession()
  const user = (session?.user as any) ?? {}

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generated audit packages and compliance reports</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <DocumentArrowDownIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-500">Audit packages appear here</p>
        <p className="text-sm text-gray-400 mt-2">
          Generate an audit package from any client&apos;s Reports page.
          <br />
          It will be listed here for MSP-level download.
        </p>
      </div>
    </div>
  )
}
