'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { getSPRSColor } from '@/lib/constants'
import clsx from 'clsx'

interface SidebarProps {
  orgSlug: string
  orgName?: string
  sprsScore?: number
}

export function Sidebar({ orgSlug, orgName, sprsScore }: SidebarProps) {
  const pathname = usePathname()
  const base = `/${orgSlug}`

  const navItems = [
    { href: `${base}/dashboard`, label: 'Dashboard', icon: HomeIcon },
    { href: `${base}/controls`, label: 'Controls', icon: ShieldCheckIcon },
    { href: `${base}/tasks`, label: 'Tasks', icon: ClipboardDocumentListIcon },
    { href: `${base}/team`, label: 'Team', icon: UsersIcon },
    { href: `${base}/poam`, label: 'POA&M', icon: DocumentTextIcon },
    { href: `${base}/reports`, label: 'Reports', icon: ChartBarIcon },
  ]

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Organization</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{orgName || orgSlug}</p>
        {sprsScore !== undefined && (
          <p className={`text-xs font-medium mt-0.5 ${getSPRSColor(sprsScore)}`}>
            SPRS: {sprsScore}
          </p>
        )}
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className={clsx('w-4 h-4', isActive ? 'text-blue-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
