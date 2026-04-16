import { useState, useEffect } from 'react'
import { Loader2, UserCog, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Input } from '../ui/input'
import { rbacApi, UserItem } from '../../lib/rbac-api'
import { useAuth } from '../../contexts/AuthContext'
import UserRoleAssigner from './UserRoleAssigner'
import CreateUserModal from './CreateUserModal'

export default function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await rbacApi.users()
      setUsers(data.users)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.roles.some(r => r.name.toLowerCase().includes(q))
    )
  })

  async function deleteUser(u: UserItem) {
    if (!confirm(`Delete ${u.name || u.email}? This removes them from the portal and Authentik.`)) return
    setDeletingId(u.sub)
    try {
      await rbacApi.deleteUser(u.sub)
      await loadUsers()
    } catch (err) {
      console.error('Failed to delete user:', err)
      alert('Failed to delete user. Check console.')
    } finally {
      setDeletingId(null)
    }
  }

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Users</CardTitle>
            <CardDescription>Manage user role assignments</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search users..."
              className="w-52"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {currentUser?.is_super_admin && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Create User
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {users.length === 0 ? 'No users have logged in yet.' : 'No users match your search.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Roles</th>
                  <th className="text-left px-4 py-2 font-medium">Last Login</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.sub} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{user.name || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? user.roles.map(r => (
                          <Badge key={r.id} variant="secondary" className="text-xs">
                            {r.name}
                          </Badge>
                        )) : (
                          <span className="text-muted-foreground text-xs">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => setEditUser(user)}
                        >
                          <UserCog className="h-3.5 w-3.5 mr-1" /> Assign
                        </Button>
                        {currentUser?.is_super_admin && user.sub !== currentUser?.sub && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            disabled={deletingId === user.sub}
                            onClick={() => deleteUser(user)}
                          >
                            {deletingId === user.sub
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editUser && (
        <UserRoleAssigner
          open={!!editUser}
          onOpenChange={() => setEditUser(null)}
          userSub={editUser.sub}
          userName={editUser.name || editUser.email}
          currentRoleIds={editUser.roles.map(r => r.id)}
          onSaved={loadUsers}
        />
      )}

      <CreateUserModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadUsers}
      />
    </Card>
  )
}
