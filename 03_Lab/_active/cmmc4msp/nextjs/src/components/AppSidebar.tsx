'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import {
  HomeIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
  SparklesIcon,
  DocumentArrowDownIcon,
  PaperClipIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  HeartIcon,
  LinkIcon,
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { getSPRSColor } from '@/lib/constants'
import clsx from 'clsx'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type NavSection = {
  label?: string
  items: NavItem[]
}

// ─── Nav configs per context ────────────────────────────────────────────────

function platformNav(): NavSection[] {
  return [
    {
      label: 'Platform',
      items: [
        { href: '/platform',          label: 'Overview',      icon: Squares2X2Icon },
        { href: '/platform/msps',     label: 'MSP Accounts',  icon: BuildingOffice2Icon },
        { href: '/platform/clients',  label: 'All Clients',   icon: BuildingOfficeIcon },
        { href: '/platform/health',   label: 'System Health', icon: HeartIcon },
        { href: '/platform/analytics',label: 'Analytics',     icon: ChartBarIcon },
      ],
    },
  ]
}

function mspNav(): NavSection[] {
  return [
    {
      label: 'Portfolio',
      items: [
        { href: '/msp',           label: 'Dashboard', icon: HomeIcon },
        { href: '/msp/clients',   label: 'Clients',   icon: BuildingOfficeIcon },
        { href: '/msp/analytics', label: 'Analytics', icon: ChartBarIcon },
        { href: '/msp/team',      label: 'Team',      icon: UsersIcon },
        { href: '/msp/reports',   label: 'Reports',   icon: DocumentArrowDownIcon },
      ],
    },
  ]
}

function orgNav(role: string, base: string): NavSection[] {
  const core: NavItem[] = [
    { href: `${base}/dashboard`, label: 'Dashboard', icon: HomeIcon },
    { href: `${base}/controls`,  label: 'Controls',  icon: ShieldCheckIcon },
    { href: `${base}/tasks`,     label: 'Tasks',      icon: ClipboardDocumentListIcon },
  ]

  if (role === 'client_user') {
    return [{ items: core }]
  }

  const extended: NavItem[] = [
    { href: `${base}/team`,                label: 'Team',       icon: UsersIcon },
    { href: `${base}/evidence-automation`, label: 'Quick Wins', icon: BoltIcon },
    { href: `${base}/artifacts`,           label: 'Artifacts',  icon: PaperClipIcon },
    { href: `${base}/poam`,                label: 'POA&M',      icon: DocumentTextIcon },
    { href: `${base}/reports`,             label: 'Reports',    icon: ChartBarIcon },
  ]

  const sections: NavSection[] = [{ items: [...core, ...extended] }]

  if (role === 'msp_admin') {
    sections.push({
      label: 'MSP Tools',
      items: [
        { href: `${base}/suggestions`, label: 'AI Suggestions', icon: SparklesIcon },
        { href: `${base}/reports`,     label: 'Audit Package',  icon: ClipboardDocumentCheckIcon },
      ],
    })
  }

  if (role === 'client_admin') {
    sections[0].items.push({
      href: `${base}/integrations`, label: 'Integrations', icon: LinkIcon,
    })
  }

  if (role === 'super_admin') {
    sections.push({
      label: 'Admin',
      items: [
        { href: `${base}/integrations`, label: 'Integrations', icon: LinkIcon },
        { href: '/platform',            label: 'Platform Hub',  icon: Squares2X2Icon },
      ],
    })
  }

  return sections
}

// ─── Role accent color ───────────────────────────────────────────────────────

const ROLE_ACCENT: Record<string, string> = {
  super_admin:  'var(--role-super)',
  msp_admin:    'var(--role-msp)',
  client_admin: 'var(--role-client)',
  client_user:  'var(--role-user)',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:  'Onnex',
  msp_admin:    'MSP Admin',
  client_admin: 'Client Admin',
  client_user:  'End User',
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface AppSidebarProps {
  context: 'org' | 'platform' | 'msp'
  orgSlug?: string
  orgName?: string
  sprsScore?: number
}

export function AppSidebar({ context, orgSlug, orgName, sprsScore }: AppSidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const user = (session?.user as any) ?? {}
  const role: string = user.role ?? 'client_user'

  const sections: NavSection[] =
    context === 'platform'
      ? platformNav()
      : context === 'msp'
      ? mspNav()
      : orgNav(role, `/${orgSlug}`)

  const accentColor = ROLE_ACCENT[role] ?? ROLE_ACCENT.client_user
  const roleLabel = ROLE_LABEL[role] ?? role

  return (
    <motion.aside
      animate={{ width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex-shrink-0 h-screen overflow-hidden flex flex-col"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0"
           style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="logo-text"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 min-w-0"
            >
              <span className="flex-shrink-0" style={{ color: accentColor }}>
                  <ShieldExclamationIcon className="w-5 h-5" />
                </span>
              <span className="text-sm font-bold truncate" style={{ color: 'var(--sidebar-text-active)' }}>
                CMMC4MSP
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <span style={{ color: accentColor }} className="flex justify-center">
          <ShieldExclamationIcon className="w-5 h-5" />
        </span>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto flex-shrink-0 p-1 rounded-md transition-colors"
          style={{ color: 'var(--sidebar-text)' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--sidebar-text-active)')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--sidebar-text)')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-4 h-4" />
          ) : (
            <ChevronLeftIcon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Org context header (org layout only) */}
      {context === 'org' && !collapsed && orgName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--sidebar-text)' }}>
            Organization
          </p>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--sidebar-text-active)' }}>
            {orgName}
          </p>
          {sprsScore !== undefined && (
            <p className={clsx('text-xs font-medium mt-0.5', getSPRSColor(sprsScore))}>
              SPRS: {sprsScore}
            </p>
          )}
        </motion.div>
      )}

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {sections.map((section, si) => (
          <div key={si}>
            <AnimatePresence initial={false}>
              {!collapsed && section.label && (
                <motion.p
                  key={`section-${si}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs uppercase tracking-wider px-3 mb-1"
                  style={{ color: 'var(--sidebar-text)' }}
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  accentColor={accentColor}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div
        className="flex-shrink-0 p-3"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
            style={{ background: accentColor }}
          >
            {(user.email?.[0] ?? '?').toUpperCase()}
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-text-active)' }}>
                  {user.email ?? ''}
                </p>
                <p className="text-xs" style={{ color: 'var(--sidebar-text)' }}>
                  {roleLabel}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

// ─── NavLink sub-component ───────────────────────────────────────────────────

function NavLink({
  item,
  pathname,
  collapsed,
  accentColor,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  accentColor: string
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        collapsed ? 'justify-center' : ''
      )}
      style={{
        color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
        background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-active)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
        }
      }}
    >
      <span className="flex-shrink-0" style={{ color: isActive ? accentColor : 'inherit' }}>
        <Icon className="w-4 h-4" />
      </span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}
