import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import { rbacApi, PermissionItem } from '../../lib/rbac-api'

interface Props {
  roleId: string
  roleName: string
  isSuperAdmin: boolean
  onSaved: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  view: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  edit: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  export: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
}

export default function RolePermissionEditor({ roleId, roleName, isSuperAdmin, onSaved }: Props) {
  const [allPerms, setAllPerms] = useState<Record<string, PermissionItem[]>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [permData, roleData] = await Promise.all([
          rbacApi.permissions(),
          rbacApi.role(roleId),
        ])
        setAllPerms(permData.grouped)
        setSelected(new Set(roleData.permissions))
      } catch (err) {
        console.error('Failed to load permissions:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [roleId])

  function toggle(code: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function selectAll(module: string) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const p of allPerms[module] || []) next.add(p.code)
      return next
    })
  }

  function deselectAll(module: string) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const p of allPerms[module] || []) next.delete(p.code)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      await rbacApi.setRolePermissions(roleId, Array.from(selected))
      onSaved()
    } catch (err) {
      console.error('Failed to save permissions:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading permissions...</div>
  }

  const modules = Object.keys(allPerms).sort()

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <p className="text-sm text-muted-foreground italic">
          super_admin always has all permissions. This view is read-only.
        </p>
      )}

      {modules.map(mod => {
        const perms = allPerms[mod]
        const allSelected = perms.every(p => selected.has(p.code))
        return (
          <div key={mod} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold capitalize">{mod}</h4>
              {!isSuperAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => allSelected ? deselectAll(mod) : selectAll(mod)}
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {perms.map(p => (
                <label
                  key={p.code}
                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={isSuperAdmin || selected.has(p.code)}
                    disabled={isSuperAdmin}
                    onCheckedChange={() => toggle(p.code)}
                  />
                  <span className="text-sm flex-1">{p.label}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[p.category] || ''}`}>
                    {p.category}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        )
      })}

      {!isSuperAdmin && (
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...</> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Save Permissions</>}
          </Button>
        </div>
      )}
    </div>
  )
}
