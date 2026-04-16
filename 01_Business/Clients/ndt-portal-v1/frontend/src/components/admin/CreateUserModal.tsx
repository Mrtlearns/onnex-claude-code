import { useState, useEffect } from 'react'
import { Loader2, UserPlus, Copy, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../ui/dialog'
import { rbacApi, RoleItem } from '../../lib/rbac-api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type Step = 'form' | 'invite'

export default function CreateUserModal({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)

  // Form state
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Creation result
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')
  const [createdEmail, setCreatedEmail] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    // Reset on open
    setStep('form')
    setEmail('')
    setName('')
    setSelectedRoles(new Set())
    setError(null)
    setTempPassword(null)
    setCopied(false)

    setLoadingRoles(true)
    rbacApi.roles()
      .then(data => setRoles(data.roles))
      .catch(err => console.error('Failed to load roles:', err))
      .finally(() => setLoadingRoles(false))
  }, [open])

  function toggleRole(roleId: string) {
    setSelectedRoles(prev => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  async function submit() {
    setError(null)
    if (!email.trim() || !name.trim()) {
      setError('Email and name are required.')
      return
    }

    setSubmitting(true)
    try {
      const result = await rbacApi.createUser({
        email: email.trim(),
        name: name.trim(),
        role_ids: Array.from(selectedRoles),
      })
      setTempPassword(result.temp_password || null)
      setCreatedName(result.name)
      setCreatedEmail(result.email)
      setStep('invite')
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyPassword() {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  function close() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Create User
              </DialogTitle>
              <DialogDescription>
                Creates the user in Authentik and the portal. An invite link is generated so they can set their password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="cu-name">Full Name</Label>
                <Input
                  id="cu-name"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cu-email">Email</Label>
                <Input
                  id="cu-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Initial Roles <span className="text-muted-foreground font-normal">(optional)</span></Label>
                {loadingRoles ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading roles...
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                    {roles.map(role => (
                      <label
                        key={role.id}
                        className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedRoles.has(role.id)}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {role.name}
                            {role.is_system && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">System</Badge>
                            )}
                          </div>
                          {role.description && (
                            <div className="text-xs text-muted-foreground">{role.description}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Creating...</>
                  : <><UserPlus className="h-3.5 w-3.5 mr-1.5" /> Create User</>
                }
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" /> User Created
              </DialogTitle>
              <DialogDescription>
                <strong>{createdName}</strong> ({createdEmail}) has been created in Authentik and
                the portal. Send them these credentials to log in for the first time.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{createdEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Temp Password</span>
                  {tempPassword ? (
                    <code className="font-mono text-sm select-all">{tempPassword}</code>
                  ) : (
                    <span className="text-muted-foreground italic">not set</span>
                  )}
                </div>
              </div>
              {tempPassword && (
                <Button variant="outline" size="sm" className="w-full" onClick={copyPassword}>
                  {copied
                    ? <><Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> Copied</>
                    : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Password</>
                  }
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                The user should log in at <strong>{window.location.origin}/login</strong> and
                change their password immediately via profile settings.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
