import { useState, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { rbacApi, RoleItem } from '../../lib/rbac-api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userSub: string
  userName: string
  currentRoleIds: string[]
  onSaved: () => void
}

export default function UserRoleAssigner({ open, onOpenChange, userSub, userName, currentRoleIds, onSaved }: Props) {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRoleIds))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(new Set(currentRoleIds))
    rbacApi.roles()
      .then(data => setRoles(data.roles))
      .catch(err => console.error('Failed to load roles:', err))
      .finally(() => setLoading(false))
  }, [open, currentRoleIds])

  function toggle(roleId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      await rbacApi.setUserRoles(userSub, Array.from(selected))
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to assign roles:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Roles — {userName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading roles...</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {roles.map(role => (
              <label key={role.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(role.id)} onCheckedChange={() => toggle(role.id)} />
                <div className="flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {role.name}
                    {role.is_system && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">System</Badge>}
                  </div>
                  {role.description && (
                    <div className="text-xs text-muted-foreground">{role.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...</> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Save</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
