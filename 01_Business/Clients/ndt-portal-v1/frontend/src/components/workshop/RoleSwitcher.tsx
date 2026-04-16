import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role, InspectionType } from '@/lib/workshop/types'
import { INSPECTION_TYPES } from '@/lib/workshop/constants'

// TODO: Replace localStorage role with Authentik OIDC role claim

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'floor_manager', label: 'Floor Manager' },
  ...INSPECTION_TYPES.map((t) => ({
    value: `${t.toLowerCase()}_inspector` as Role,
    label: `${t} Inspector`,
  })),
]

function loadRole(): Role {
  return (localStorage.getItem('workshop_role') as Role) ?? 'floor_manager'
}

function saveRole(role: Role) {
  localStorage.setItem('workshop_role', role)
}

interface RoleSwitcherProps {
  onRoleChange?: (role: Role) => void
}

export function RoleSwitcher({ onRoleChange }: RoleSwitcherProps) {
  const [role, setRole] = useState<Role>(loadRole)
  const [open, setOpen] = useState(false)

  function select(r: Role) {
    setRole(r)
    saveRole(r)
    setOpen(false)
    onRoleChange?.(r)
  }

  const current = ROLE_OPTIONS.find((o) => o.value === role)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
          'bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]',
          'hover:bg-[var(--ws-glass-bg-hover)] transition-colors text-[var(--ws-text-primary)]'
        )}
      >
        {current?.label ?? 'Select Role'}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-1 z-50 min-w-[180px]',
          'bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]',
          'rounded-md shadow-lg overflow-hidden'
        )}>
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                role === opt.value
                  ? 'bg-[var(--ws-accent)] text-white'
                  : 'text-[var(--ws-text-primary)] hover:bg-[var(--ws-glass-bg-hover)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Returns which inspection type a role can see (null = floor manager, sees all) */
// eslint-disable-next-line react-refresh/only-export-components
export function roleToInspectionType(role: Role): InspectionType | null {
  if (role === 'floor_manager') return null
  const type = role.replace('_inspector', '').toUpperCase() as InspectionType
  return INSPECTION_TYPES.includes(type) ? type : null
}

// eslint-disable-next-line react-refresh/only-export-components
export function isFloorManager(role: Role): boolean {
  return role === 'floor_manager'
}

// eslint-disable-next-line react-refresh/only-export-components
export { loadRole }
