import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Radio, Activity, ClipboardList,
  Wrench, Settings, ChevronRight, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import FeedbackButton from '@/components/feedback/FeedbackButton'

// Map pathnames to breadcrumb labels + icons
const PAGE_MAP: { match: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { match: '/admin',     label: 'Admin',           icon: ShieldCheck     },
  { match: '/settings',  label: 'Settings',       icon: Settings        },
  { match: '/tools',     label: 'Tools',           icon: Wrench          },
  { match: '/analysis',  label: 'Pipeline',        icon: Activity        },
  { match: '/quotes',    label: 'Quote History',   icon: ClipboardList   },
  { match: '/rt',        label: 'RT Costing',      icon: Radio           },
  { match: '/ut',        label: 'UT Calculator',   icon: Activity        },
  { match: '/',          label: 'Dashboards',      icon: LayoutDashboard },
]

function usePage() {
  const { pathname } = useLocation()
  return PAGE_MAP.find(p => p.match === '/' ? pathname === '/' : pathname.startsWith(p.match))
    ?? PAGE_MAP[PAGE_MAP.length - 1]
}

// ── Quick-action button (Settings / Tools) ──────────────────────
function QuickBtn({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        )
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

// ── Component ───────────────────────────────────────────────────
export default function Topbar() {
  const page = usePage()
  const Icon = page.icon

  return (
    <header className="flex items-center h-11 px-4 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground/50 text-xs tracking-wide uppercase">NDT Portal</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-40" />
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{page.label}</span>
      </div>

      <div className="flex-1" />

      {/* ── Quick-access: Feedback + Tools + Settings ── */}
      <div className="flex items-center gap-1">
        <FeedbackButton />
        <QuickBtn to="/tools"    icon={Wrench}   label="Tools"    />
        <QuickBtn to="/settings" icon={Settings} label="Settings" />
      </div>
    </header>
  )
}
