import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Shield, Loader2, Lock } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { rbacApi, RoleItem } from '../../lib/rbac-api'
import RolePermissionEditor from './RolePermissionEditor'

export default function RolesTab() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function loadRoles() {
    setLoading(true)
    try {
      const data = await rbacApi.roles()
      setRoles(data.roles)
    } catch (err) {
      console.error('Failed to load roles:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRoles() }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await rbacApi.createRole(newName.trim(), newDesc.trim())
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      await loadRoles()
    } catch (err) {
      console.error('Failed to create role:', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await rbacApi.deleteRole(deleteTarget.id)
      setDeleteTarget(null)
      await loadRoles()
    } catch (err) {
      console.error('Failed to delete role:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Roles</CardTitle>
            <CardDescription>Manage roles and their permissions</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Role
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading roles...
          </div>
        ) : (
          <div className="space-y-1">
            {roles.map(role => {
              const expanded = expandedId === role.id
              return (
                <div key={role.id} className="border rounded-lg">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left"
                    onClick={() => setExpandedId(expanded ? null : role.id)}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{role.name}</span>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Lock className="h-2.5 w-2.5 mr-0.5" /> System
                          </Badge>
                        )}
                      </div>
                      {role.description && (
                        <div className="text-xs text-muted-foreground truncate">{role.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{role.permission_count} permissions</span>
                      <span>{role.user_count} users</span>
                    </div>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(role) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 border-t">
                      <RolePermissionEditor
                        roleId={role.id}
                        roleName={role.name}
                        isSuperAdmin={role.name === 'super_admin'}
                        onSaved={loadRoles}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. shift_supervisor"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Will be converted to lowercase with underscores
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="What this role can do"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Delete role <strong>{deleteTarget?.name}</strong>?
            {(deleteTarget?.user_count ?? 0) > 0 && (
              <span className="text-destructive"> This role is assigned to {deleteTarget?.user_count} user(s).</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
