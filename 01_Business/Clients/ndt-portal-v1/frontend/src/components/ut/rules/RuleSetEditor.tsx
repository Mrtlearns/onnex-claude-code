import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Plus, Table2, Grid3X3, Code, Users } from 'lucide-react'
import { fetchRuleSets, fetchRuleSet, fetchVersion, publishVersion, createRuleSet, fetchRuleSetCustomers } from '@/lib/ut/rulesApi'
import type { RuleSet, RuleSetDetail, VersionWithRules, Rule, PublishRuleInput } from '@/lib/ut/types-rules'
import TableFormEditor from './TableFormEditor'
import GridEditor from './GridEditor'
import CodeEditor from './CodeEditor'
import VersionHistory from './VersionHistory'
import NamedVariablesPanel from './NamedVariablesPanel'

type EditorMode = 'table' | 'grid' | 'code'

interface RuleSetEditorProps {
  initialRuleSetId?: string | null
}

export default function RuleSetEditor({ initialRuleSetId }: RuleSetEditorProps = {}) {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([])
  const [selectedRsId, setSelectedRsId] = useState<string>('')
  const [ruleSetCustomers, setRuleSetCustomers] = useState<Array<{ id: string; name: string; rule_version_pin: number | null }>>([])

  const [ruleSetDetail, setRuleSetDetail] = useState<RuleSetDetail | null>(null)
  const [versionData, setVersionData] = useState<VersionWithRules | null>(null)
  const [editedRules, setEditedRules] = useState<Rule[]>([])
  const [editorMode, setEditorMode] = useState<EditorMode>('table')
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishNotes, setPublishNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')

  // Load rule sets on mount
  useEffect(() => {
    fetchRuleSets()
      .then(rs => {
        setRuleSets(rs)
        // Use initialRuleSetId if provided, otherwise first rule set
        const targetId = initialRuleSetId ?? (rs.length > 0 ? rs[0].id : '')
        if (targetId) setSelectedRsId(targetId)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Switch to initialRuleSetId when it changes (e.g., from Customers tab)
  useEffect(() => {
    if (initialRuleSetId && initialRuleSetId !== selectedRsId) {
      setSelectedRsId(initialRuleSetId)
    }
  }, [initialRuleSetId])

  // Load rule set detail + customers when selected
  useEffect(() => {
    if (!selectedRsId) return
    fetchRuleSet(selectedRsId)
      .then(d => {
        setRuleSetDetail(d)
        const latest = d.versions.find(v => v.is_latest)
        if (latest) loadVersion(latest.id)
      })
      .catch(e => setError(e.message))
    fetchRuleSetCustomers(selectedRsId)
      .then(setRuleSetCustomers)
      .catch(() => setRuleSetCustomers([]))
  }, [selectedRsId])

  const loadVersion = useCallback((versionId: string) => {
    fetchVersion(versionId)
      .then(v => {
        setVersionData(v)
        setEditedRules(JSON.parse(JSON.stringify(v.rules)))
      })
      .catch(e => setError(e.message))
  }, [])

  async function handlePublish() {
    if (!versionData || editedRules.length === 0) return
    setPublishing(true)
    setError(null)
    try {
      const rules: PublishRuleInput[] = editedRules.map(r => ({
        category: r.category,
        geometryType: r.geometry_type,
        sortOrder: r.sort_order,
        label: r.label,
        description: r.description ?? undefined,
        definition: r.definition as Record<string, unknown>,
      }))
      const result = await publishVersion(versionData.id, { notes: publishNotes || undefined, rules })
      setPublishNotes('')
      // Reload the rule set to show new version
      const detail = await fetchRuleSet(selectedRsId)
      setRuleSetDetail(detail)
      loadVersion(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleCreateRuleSet() {
    if (!newName.trim()) return
    try {
      const cloneVersionId = versionData?.id
      const result = await createRuleSet({
        name: newName.trim(),
        cloneFromVersionId: cloneVersionId,
      })
      const rs = await fetchRuleSets()
      setRuleSets(rs)
      setSelectedRsId(result.id)
      setShowNewDialog(false)
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const isReadOnly = versionData ? !versionData.is_latest : true
  const hasChanges = versionData ? JSON.stringify(editedRules) !== JSON.stringify(versionData.rules) : false

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading rule sets...</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left: Editor */}
      <div className="lg:col-span-3 space-y-4">
        {/* Toolbar */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Rule set selector */}
              <Select value={selectedRsId} onValueChange={setSelectedRsId}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Select rule set" />
                </SelectTrigger>
                <SelectContent>
                  {ruleSets.map(rs => (
                    <SelectItem key={rs.id} value={rs.id}>{rs.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Version info */}
              {versionData && (
                <Badge variant={versionData.is_latest ? 'default' : 'secondary'} className="text-xs">
                  v{versionData.version}{versionData.is_latest ? ' (latest)' : ' (read-only)'}
                </Badge>
              )}

              {/* Customer context */}
              {ruleSetCustomers.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  {ruleSetCustomers.map(c => (
                    <Badge key={c.id} variant="outline" className="text-[10px]">
                      {c.name}{c.rule_version_pin ? ` (pinned v${c.rule_version_pin})` : ''}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex-1" />

              {/* Editor mode toggle */}
              <div className="flex border rounded-md overflow-hidden">
                <button
                  onClick={() => setEditorMode('table')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 ${editorMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <Table2 className="h-3 w-3" /> Table
                </button>
                <button
                  onClick={() => setEditorMode('grid')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 border-x ${editorMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <Grid3X3 className="h-3 w-3" /> Grid
                </button>
                <button
                  onClick={() => setEditorMode('code')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 ${editorMode === 'code' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <Code className="h-3 w-3" /> Code
                </button>
              </div>

              {/* Actions */}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowNewDialog(!showNewDialog)}>
                <Plus className="h-3 w-3" /> New
              </Button>
            </div>

            {/* New rule set dialog */}
            {showNewDialog && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Input
                  placeholder="Rule set name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="h-7 text-sm w-48"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleCreateRuleSet}>
                  Create{versionData ? ' (clone current)' : ''}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewDialog(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {/* Publish bar */}
            {!isReadOnly && hasChanges && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Input
                  placeholder="Version notes (optional)"
                  value={publishNotes}
                  onChange={e => setPublishNotes(e.target.value)}
                  className="h-7 text-sm flex-1"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={publishing}
                  onClick={handlePublish}
                >
                  {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Publish v{(versionData?.version ?? 0) + 1}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive px-1">{error}</p>}

        {/* Editor */}
        {editedRules.length > 0 && (
          <>
            {editorMode === 'table' && (
              <TableFormEditor rules={editedRules} onChange={setEditedRules} readOnly={isReadOnly} />
            )}
            {editorMode === 'grid' && (
              <GridEditor rules={editedRules} onChange={setEditedRules} readOnly={isReadOnly} />
            )}
            {editorMode === 'code' && (
              <CodeEditor rules={editedRules} onChange={setEditedRules} readOnly={isReadOnly} />
            )}
          </>
        )}
      </div>

      {/* Right: Version History + Named Variables */}
      <div className="space-y-4">
        <VersionHistory
          versions={ruleSetDetail?.versions ?? []}
          activeVersionId={versionData?.id ?? null}
          onSelectVersion={loadVersion}
        />
        <NamedVariablesPanel customers={ruleSetCustomers} />
      </div>
    </div>
  )
}
