import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Radio, Activity, ClipboardList,
  Settings, Moon, Sun, ChevronLeft, Pin, PinOff,
  Wrench, ShieldCheck, FolderOpen, Database,
  Factory, FlaskConical, LogOut, User as UserIcon, Palette,
  Inbox, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { THEMES } from '@/lib/themes'

// ── Nav items with required permissions ─────────────────────────
const NAV = [
  { to: '/',             end: true,  icon: LayoutDashboard, label: 'Dashboards',    permission: 'DASHBOARD_VIEW' },
  { to: '/rt',           end: false, icon: Radio,           label: 'RT Costing',    permission: 'RT_VIEW' },
  { to: '/ut',           end: false, icon: Activity,        label: 'UT Calculator', permission: 'UT_VIEW' },
  { to: '/quotes',       end: false, icon: ClipboardList,   label: 'Quote History', permission: 'QUOTE_VIEW' },
  { to: '/documents',    end: false, icon: FolderOpen,      label: 'Documents',     permission: 'DOCUMENT_VIEW' },
  { to: '/sf-analysis',  end: false, icon: Database,        label: 'SF Analysis',   permission: 'SF_ANALYSIS_VIEW' },
  { to: '/tools',        end: false, icon: Wrench,          label: 'Tools',         permission: 'TOOLS_VIEW' },
  { to: '/admin',        end: false, icon: ShieldCheck,     label: 'Admin',         permission: 'ADMIN_VIEW' },
  { to: '/inbox',         end: false, icon: Inbox,            label: 'Inbox',         permission: 'INBOX_VIEW' },
  { to: '/quote-analyses', end: false, icon: BarChart2,      label: 'Quote Analyses', permission: 'QUOTE_ANALYSIS_VIEW' },
  { to: '/settings',     end: false, icon: Settings,        label: 'Settings',      permission: 'SETTINGS_VIEW' },
]

const WORKSHOP_NAV = [
  { to: '/workshop',            end: true,  icon: Factory,       label: 'Workshop',   permission: 'WORKSHOP_VIEW' },
  { to: '/workshop/simulation', end: false, icon: FlaskConical,  label: 'Simulation', permission: 'WORKSHOP_SIMULATION' },
]

// ── Sidebar widths ─────────────────────────────────────────────
const W_COLLAPSED = 56   // px — icon-only rail
const W_EXPANDED  = 220  // px — icon + label

// ── User Widget ───────────────────────────────────────────────────
function UserWidget({ open }: { open: boolean }) {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <div className="flex flex-col gap-2 px-1.5 py-3 shrink-0 border-b border-border">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <UserIcon className="h-4 w-4" />
        </div>
        {open && (
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.role}</div>
          </div>
        )}
      </div>
      <button
        onClick={() => logout()}
        title="Sign out"
        className={cn(
          'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
          'overflow-hidden whitespace-nowrap w-full text-left',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span className={cn(
          'transition-[opacity,transform] duration-200',
          open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
        )}>
          Sign out
        </span>
      </button>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────
interface SidebarProps {
  dark: boolean
  onToggleDark: () => void
  theme: string
  onSetTheme: (id: string) => void
}

export default function Sidebar({ dark, onToggleDark, theme, onSetTheme }: SidebarProps) {
  const location = useLocation()
  const { hasPermission } = useAuth()

  // pinned = user locked it open; hovering = temporary expand on mouse-enter
  const [pinned, setPinned]   = useState<boolean>(() => localStorage.getItem('sidebar_pinned') === 'true')
  const [hovering, setHovering] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = pinned || hovering
  const width = open ? W_EXPANDED : W_COLLAPSED

  // Persist pin state
  useEffect(() => {
    localStorage.setItem('sidebar_pinned', String(pinned))
  }, [pinned])

  function handleMouseEnter() {
    if (pinned) return
    hoverTimer.current = setTimeout(() => setHovering(true), 80)
  }
  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (!pinned) setHovering(false)
  }

  // Active-check helper for non-end routes
  function isActive(to: string, end: boolean) {
    if (end) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ width }}
      className={cn(
        'relative flex flex-col h-screen shrink-0 overflow-hidden',
        'bg-card border-r border-border',
        'transition-[width] duration-200 ease-in-out',
        'z-40',
      )}
    >
      {/* ── Logo / brand ── */}
      <div className="flex items-center h-14 px-3 shrink-0 gap-2.5 border-b border-border overflow-hidden">
        <img
          src="/NDTesting_Logo.png"
          alt="NDT"
          className="shrink-0 object-contain"
          style={{ height: open ? '36px' : '32px', width: 'auto', transition: 'height 200ms' }}
        />
        <span
          className={cn(
            'font-bold text-sm tracking-tight whitespace-nowrap',
            'transition-[opacity,transform] duration-200',
            open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none',
          )}
        >
          NDT Portal
        </span>
      </div>

      {/* ── Main nav ── */}
      <nav className="flex flex-col gap-0.5 px-1.5 pt-3 flex-1 overflow-hidden">
        {NAV.filter(item => hasPermission(item.permission)).map(({ to, end, icon: Icon, label }) => {
          const active = isActive(to, end)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                'overflow-hidden whitespace-nowrap',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              title={!open ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  'transition-[opacity,transform] duration-200',
                  open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
                )}
              >
                {label}
              </span>
            </NavLink>
          )
        })}

        {/* ── Workshop group ── */}
        <div className={cn(
          'mt-1 pt-1 border-t border-border transition-[opacity] duration-200',
          open ? 'opacity-100' : 'opacity-60'
        )}>
          {open && (
            <span className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Workshop
            </span>
          )}
          {WORKSHOP_NAV.filter(item => hasPermission(item.permission)).map(({ to, end, icon: Icon, label }) => {
            const active = isActive(to, end)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                  'overflow-hidden whitespace-nowrap',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                title={!open ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(
                  'transition-[opacity,transform] duration-200',
                  open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
                )}>
                  {label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* ── User Profile + Logout ── */}
      <UserWidget open={open} />

      {/* ── Bottom controls ── */}
      <div className="flex flex-col gap-0.5 px-1.5 pb-3 shrink-0 border-t border-border pt-2">

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDark}
          title={dark ? 'Light mode' : 'Dark mode'}
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
            'overflow-hidden whitespace-nowrap w-full text-left',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {dark
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />}
          <span className={cn(
            'transition-[opacity,transform] duration-200',
            open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
          )}>
            {dark ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        {/* Theme selector */}
        <div className="relative group">
          <button
            title={`Theme: ${THEMES.find(t => t.id === theme)?.label ?? theme}`}
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
              'overflow-hidden whitespace-nowrap w-full text-left',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            <Palette className="h-4 w-4 shrink-0" />
            <span className={cn(
              'transition-[opacity,transform] duration-200 flex-1',
              open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
            )}>
              {THEMES.find(t => t.id === theme)?.label ?? theme}
            </span>
          </button>
          {/* Dropdown — shown on hover when sidebar is open */}
          {open && (
            <div className={cn(
              'absolute bottom-full left-0 mb-1 w-full rounded-md border border-border',
              'bg-popover shadow-lg py-1 z-50',
              'hidden group-hover:block',
            )}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSetTheme(t.id)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs transition-colors',
                    'hover:bg-muted hover:text-foreground',
                    t.id === theme
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground',
                  )}
                >
                  {t.label}
                  <span className="ml-1 text-muted-foreground font-normal">{t.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pin / unpin */}
        <button
          onClick={() => setPinned(p => !p)}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
            'overflow-hidden whitespace-nowrap w-full text-left',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {pinned
            ? <PinOff className="h-4 w-4 shrink-0" />
            : <Pin className="h-4 w-4 shrink-0" />}
          <span className={cn(
            'transition-[opacity,transform] duration-200',
            open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
          )}>
            {pinned ? 'Unpin sidebar' : 'Pin open'}
          </span>
        </button>

        {/* Collapse button (only shown when pinned) */}
        {pinned && (
          <button
            onClick={() => setPinned(false)}
            title="Collapse sidebar"
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
              'overflow-hidden whitespace-nowrap w-full text-left',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className={cn(
              'transition-[opacity,transform] duration-200',
              open ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none w-0',
            )}>
              Collapse
            </span>
          </button>
        )}
      </div>
    </aside>
  )
}
