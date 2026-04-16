'use client'

import { useState, FormEvent } from 'react'
import { Node } from '@/db/schema'
import { useUniverseStore } from '@/store/universe'
import GlassButton from '@/components/ui/GlassButton'

interface NodeFormProps {
  node?: Node
  parentId?: string   // if set: create as subtopic of this node
  onClose: () => void
}

const NODE_TYPES = ['note', 'task', 'idea', 'reference', 'person', 'project'] as const

function toLocalDatetimeValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  // Format as "YYYY-MM-DDTHH:mm" for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NodeForm({ node, parentId, onClose }: NodeFormProps) {
  const { createNode, updateNode, createEdge, nodes } = useUniverseStore()
  const isEdit = !!node

  const [title, setTitle] = useState(node?.title ?? '')
  const [content, setContent] = useState(node?.content ?? '')
  const [type, setType] = useState(node?.type ?? 'note')
  const [tags, setTags] = useState((node?.tags as string[] ?? []).join(', '))
  const [x, setX] = useState(node?.x ?? Math.random() * 400 - 200)
  const [y, setY] = useState(node?.y ?? Math.random() * 400 - 200)
  const [z, setZ] = useState(node?.z ?? Math.random() * 400 - 200)
  const [isPublic, setIsPublic] = useState(node?.is_public ?? false)
  const [dueDate, setDueDate] = useState(toLocalDatetimeValue(node?.due_date))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')

    try {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
      const dueDateISO = dueDate ? new Date(dueDate).toISOString() : null

      if (isEdit && node) {
        await updateNode(node.id, {
          title: title.trim(),
          content: content || undefined,
          type,
          tags: tagList,
          x, y, z,
          is_public: isPublic,
          due_date: dueDateISO,
        })
      } else {
        const newNode = await createNode({
          title: title.trim(),
          content: content || undefined,
          type,
          tags: tagList,
          x, y, z,
          is_public: isPublic,
          due_date: dueDateISO,
        })

        // If creating as a subtopic, wire the parent edge
        if (newNode && parentId) {
          await createEdge({
            source_id: newNode.id,
            target_id: parentId,
            type: 'part_of',
          })
        }
      }
      onClose()
    } catch {
      setError('Failed to save node')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg glass p-6 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isEdit ? 'Edit Topic' : parentId ? 'New Subtopic' : 'New Topic'}
            </h2>
            {parentNode && !isEdit && (
              <p className="text-xs text-white/40 mt-0.5">Subtopic of: {parentNode.title}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Topic title"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20
                         text-white placeholder-white/30 text-sm outline-none
                         focus:border-blue-400/60 transition-all"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Type</label>
            <div className="flex flex-wrap gap-2">
              {NODE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize
                    ${type === t
                      ? 'bg-blue-500/40 border-blue-400/50 text-white'
                      : 'bg-white/5 border-white/15 text-white/50 hover:text-white/80'}
                  `}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Optional content, notes, or description..."
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20
                         text-white placeholder-white/30 text-sm outline-none resize-none
                         focus:border-blue-400/60 transition-all"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20
                         text-white text-sm outline-none focus:border-blue-400/60 transition-all
                         [color-scheme:dark]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ai, research, important"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20
                         text-white placeholder-white/30 text-sm outline-none
                         focus:border-blue-400/60 transition-all"
            />
          </div>

          {/* 3D Position */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">3D Position</label>
            <div className="grid grid-cols-3 gap-2">
              {([['X', x, setX], ['Y', y, setY], ['Z', z, setZ]] as const).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="text-xs text-white/30 mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={Math.round(val)}
                    onChange={(e) => (setter as (v: number) => void)(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/20
                               text-white text-xs outline-none focus:border-blue-400/60 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Public */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-white/60">Public topic</span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <GlassButton variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : parentId ? 'Create Subtopic' : 'Create Topic'}
            </GlassButton>
            <GlassButton type="button" onClick={onClose}>Cancel</GlassButton>
          </div>
        </form>
      </div>
    </div>
  )
}
