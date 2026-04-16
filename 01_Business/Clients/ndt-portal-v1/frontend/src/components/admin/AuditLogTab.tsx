import { useState, useEffect } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { rbacApi, AuditEntry } from '../../lib/rbac-api'

const PAGE_SIZE = 25

const ACTION_COLORS: Record<string, string> = {
  role_created: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  role_updated: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  role_deleted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  role_permissions_updated: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  user_roles_updated: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  permission_denied: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  login: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
}

export default function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  async function load(newOffset: number) {
    setLoading(true)
    try {
      const data = await rbacApi.auditLog({ limit: PAGE_SIZE, offset: newOffset })
      setEntries(data.entries)
      setTotal(data.total)
      setOffset(newOffset)
    } catch (err) {
      console.error('Failed to load audit log:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0) }, [])

  function formatDate(d: string) {
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Audit Log</CardTitle>
        <CardDescription>RBAC changes and access control events</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No audit entries yet.</div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium">Time</th>
                    <th className="text-left px-4 py-2 font-medium">User</th>
                    <th className="text-left px-4 py-2 font-medium">Action</th>
                    <th className="text-left px-4 py-2 font-medium">Resource</th>
                    <th className="text-left px-4 py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <>
                      <tr
                        key={entry.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      >
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-xs">{entry.user_name || entry.user_id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={`text-[10px] ${ACTION_COLORS[entry.action] || ''}`}>
                            {entry.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{entry.resource || '—'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{entry.ip_address || '—'}</td>
                      </tr>
                      {expandedId === entry.id && entry.details && (
                        <tr key={`${entry.id}-details`}>
                          <td colSpan={5} className="px-4 py-2 bg-muted/20">
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {total} entries — Page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline" size="sm" className="h-7"
                    disabled={offset === 0}
                    onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline" size="sm" className="h-7"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => load(offset + PAGE_SIZE)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
