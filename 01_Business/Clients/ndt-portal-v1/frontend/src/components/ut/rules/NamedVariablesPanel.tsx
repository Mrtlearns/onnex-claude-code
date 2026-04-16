import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, Globe, User } from 'lucide-react'
import {
  fetchNamedVariables,
  setGlobalNamedVariable,
  deleteGlobalNamedVariable,
  setCustomerNamedVariable,
  deleteCustomerNamedVariable,
  type NamedVariablesData,
} from '@/lib/ut/rulesApi'

// Variable keys: lowercase letters, digits, underscores; must start with a letter
const VAR_KEY_RE = /^[a-z][a-z0-9_]*$/

const RESERVED_KEYS = new Set([
  'hourly_rate', 'cscan_rate', 'technique_fee', 'env_fee_rate',
  'min_charge', 'cscan_min_charge', 'has_env_fee', 'has_tech_fee', 'lot_pattern',
])

interface AddRowProps {
  onAdd: (key: string, value: string) => Promise<void>
}

function AddRow({ onAdd }: AddRowProps) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!key || !value) return
    if (!VAR_KEY_RE.test(key)) {
      setError('Key must be lowercase letters/digits/underscores, starting with a letter')
      return
    }
    if (RESERVED_KEYS.has(key)) {
      setError(`'${key}' is a reserved variable name`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdd(key, value)
      setKey('')
      setValue('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" /> Add variable
      </button>
    )
  }

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-1.5">
        <Input
          placeholder="key_name"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="h-6 text-xs font-mono w-32"
          autoFocus
        />
        <span className="text-xs text-muted-foreground">=</span>
        <Input
          placeholder="value"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-6 text-xs font-mono flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button size="sm" className="h-6 text-[11px] px-2" onClick={handleAdd} disabled={saving || !key || !value}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  )
}

interface VarRowProps {
  varKey: string
  value: number | string
  onSave: (key: string, value: string) => Promise<void>
  onDelete: (key: string) => Promise<void>
}

function VarRow({ varKey, value, onSave, onDelete }: VarRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(varKey, draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(varKey)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono text-blue-300 w-36 shrink-0 truncate" title={varKey}>{varKey}</span>
      {editing ? (
        <>
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="h-6 text-xs font-mono flex-1"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
          <Button size="sm" className="h-6 text-[11px] px-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <button
            className="flex-1 text-left text-xs font-mono text-muted-foreground hover:text-foreground truncate"
            onClick={() => { setDraft(String(value)); setEditing(true) }}
          >
            {String(value)}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Delete variable"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </>
      )}
    </div>
  )
}

interface CustomerRef {
  id: string
  name: string
  rule_version_pin: number | null
}

interface Props {
  customers: CustomerRef[]
}

export default function NamedVariablesPanel({ customers }: Props) {
  const [data, setData] = useState<NamedVariablesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Auto-select when exactly 1 customer; user picks when multiple
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    customers.length === 1 ? customers[0].id : null,
  )

  // Keep auto-selection in sync when customers prop changes
  useEffect(() => {
    if (customers.length === 1) setSelectedCustomerId(customers[0].id)
    else if (customers.length === 0) setSelectedCustomerId(null)
  }, [customers])

  const load = useCallback(() => {
    setLoading(true)
    fetchNamedVariables()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const activeCustomer = data?.customers.find(c => c.id === selectedCustomerId)

  async function handleSetGlobal(key: string, value: string) {
    const numVal = Number(value)
    await setGlobalNamedVariable(key, isNaN(numVal) ? value : numVal)
    load()
  }

  async function handleDeleteGlobal(key: string) {
    await deleteGlobalNamedVariable(key)
    load()
  }

  async function handleSetCustomer(key: string, value: string) {
    if (!selectedCustomerId) return
    const numVal = Number(value)
    await setCustomerNamedVariable(selectedCustomerId, key, isNaN(numVal) ? value : numVal)
    load()
  }

  async function handleDeleteCustomer(key: string) {
    if (!selectedCustomerId) return
    await deleteCustomerNamedVariable(selectedCustomerId, key)
    load()
  }

  return (
    <Card>
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-sm">Named Variables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {data && (
          <>
            {/* Global variables */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Global</span>
                <Badge variant="outline" className="text-[9px] px-1">{Object.keys(data.global).length}</Badge>
              </div>
              <div className="space-y-1 pl-4">
                {Object.entries(data.global).map(([k, v]) => (
                  <VarRow
                    key={k}
                    varKey={k}
                    value={v}
                    onSave={handleSetGlobal}
                    onDelete={handleDeleteGlobal}
                  />
                ))}
                {Object.keys(data.global).length === 0 && (
                  <p className="text-[10px] text-muted-foreground">No global variables defined</p>
                )}
                <AddRow onAdd={handleSetGlobal} />
              </div>
            </div>

            {/* Customer variables */}
            {customers.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Customer</span>
                  {activeCustomer && (
                    <Badge variant="outline" className="text-[9px] px-1">{Object.keys(activeCustomer.variables).length}</Badge>
                  )}
                </div>

                {/* Dropdown when multiple customers share this rule set */}
                {customers.length > 1 && (
                  <Select
                    value={selectedCustomerId ?? ''}
                    onValueChange={v => setSelectedCustomerId(v || null)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select customer…" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}{c.rule_version_pin ? ` (pinned v${c.rule_version_pin})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {activeCustomer ? (
                  <div className="space-y-1 pl-4">
                    {Object.entries(activeCustomer.variables).map(([k, v]) => (
                      <VarRow
                        key={k}
                        varKey={k}
                        value={v}
                        onSave={handleSetCustomer}
                        onDelete={handleDeleteCustomer}
                      />
                    ))}
                    {Object.keys(activeCustomer.variables).length === 0 && (
                      <p className="text-[10px] text-muted-foreground">No customer overrides</p>
                    )}
                    <AddRow onAdd={handleSetCustomer} />
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground pl-4">
                    {customers.length > 1 ? 'Select a customer above to manage their variable overrides.' : 'Loading…'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
