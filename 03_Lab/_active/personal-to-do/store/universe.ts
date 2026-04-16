import { create } from 'zustand'
import type { Node, Edge } from '@/db/schema'

export type { Node, Edge }

export interface Artifact {
  id: string
  node_id: string
  artifact_type: 'text' | 'image' | 'file' | 'url' | 'voice'
  content: string | null
  filename: string | null
  storage_path: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  deleted_at: string | null
  public_url?: string | null
}

export interface CreateNodeInput {
  title: string
  content?: string
  type?: string
  x?: number
  y?: number
  z?: number
  color?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  is_public?: boolean
  due_date?: string | null
}

export interface CreateEdgeInput {
  source_id: string
  target_id: string
  label?: string
  type?: 'relates_to' | 'depends_on' | 'blocks' | 'part_of' | 'caused_by'
  strength?: number
}

interface UniverseStore {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  focusedNodeId: string | null
  viewMode: 'universe' | 'mindmap'
  rotation: { x: number; y: number }
  canvasScale: number
  loading: boolean
  error: string | null
  artifacts: Record<string, Artifact[]>
  artifactsLoading: boolean
  trashedArtifacts: Artifact[]
  showTrash: boolean

  fetchAll: () => Promise<void>
  createNode: (data: CreateNodeInput) => Promise<Node | null>
  updateNode: (id: string, data: Partial<CreateNodeInput & { archived: boolean }>) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  selectNode: (id: string | null) => void
  setFocusedNode: (id: string | null) => void
  setViewMode: (mode: 'universe' | 'mindmap') => void
  setRotation: (x: number, y: number) => void
  setCanvasScale: (scale: number) => void
  setNodePositionLocal: (id: string, x: number, y: number, z: number) => void

  fetchEdges: () => Promise<void>
  createEdge: (data: CreateEdgeInput) => Promise<Edge | null>
  deleteEdge: (id: string) => Promise<void>

  fetchArtifacts: (nodeId: string) => Promise<void>
  addArtifact: (artifact: Artifact) => void
  removeArtifact: (nodeId: string, artifactId: string) => void
  fetchTrash: () => Promise<void>
  restoreArtifact: (artifact: Artifact) => Promise<void>
  setShowTrash: (show: boolean) => void
}

export const useUniverseStore = create<UniverseStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  focusedNodeId: null,
  viewMode: 'universe',
  rotation: { x: 0, y: 0 },
  canvasScale: 1.0,
  loading: false,
  error: null,
  artifacts: {},
  artifactsLoading: false,
  trashedArtifacts: [],
  showTrash: false,

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        fetch('/api/nodes'),
        fetch('/api/edges'),
      ])
      if (!nodesRes.ok) throw new Error('Failed to fetch topics')
      const nodes = await nodesRes.json()
      const edges = edgesRes.ok ? await edgesRes.json() : []
      set({ nodes, edges, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  createNode: async (data: CreateNodeInput) => {
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create topic')
      const node: Node = await res.json()
      set((state) => ({ nodes: [...state.nodes, node] }))
      return node
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  updateNode: async (id: string, data) => {
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update topic')
      const updated: Node = await res.json()
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? updated : n)),
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },

  deleteNode: async (id: string) => {
    try {
      const res = await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete topic')
      set((state) => {
        const { [id]: _, ...remainingArtifacts } = state.artifacts
        return {
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source_id !== id && e.target_id !== id),
          artifacts: remainingArtifacts,
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
          focusedNodeId: state.focusedNodeId === id ? null : state.focusedNodeId,
        }
      })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  selectNode: (id) => set({ selectedNodeId: id }),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setRotation: (x, y) => set({ rotation: { x, y } }),
  setCanvasScale: (scale) => set({ canvasScale: Math.min(2.5, Math.max(0.4, scale)) }),
  setNodePositionLocal: (id, x, y, z) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y, z } : n)),
    }))
  },

  fetchEdges: async () => {
    try {
      const res = await fetch('/api/edges')
      if (!res.ok) return
      const data: Edge[] = await res.json()
      set({ edges: data })
    } catch (err) {
      console.error('fetchEdges error:', err)
    }
  },

  createEdge: async (data: CreateEdgeInput) => {
    try {
      const res = await fetch('/api/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create edge')
      const edge: Edge = await res.json()
      set((state) => ({ edges: [...state.edges, edge] }))
      return edge
    } catch (err) {
      console.error('createEdge error:', err)
      return null
    }
  },

  deleteEdge: async (id: string) => {
    try {
      const res = await fetch(`/api/edges/${id}`, { method: 'DELETE' })
      if (!res.ok) return
      set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }))
    } catch (err) {
      console.error('deleteEdge error:', err)
    }
  },

  fetchArtifacts: async (nodeId: string) => {
    set({ artifactsLoading: true })
    try {
      const res = await fetch(`/api/attachments?node_id=${nodeId}`)
      if (!res.ok) throw new Error('Failed to fetch artifacts')
      const data: Artifact[] = await res.json()
      set((state) => ({
        artifacts: { ...state.artifacts, [nodeId]: data },
        artifactsLoading: false,
      }))
    } catch (err) {
      console.error('fetchArtifacts error:', err)
      set({ artifactsLoading: false })
    }
  },

  addArtifact: (artifact: Artifact) => {
    set((state) => ({
      artifacts: {
        ...state.artifacts,
        [artifact.node_id]: [...(state.artifacts[artifact.node_id] ?? []), artifact],
      },
    }))
  },

  removeArtifact: (nodeId: string, artifactId: string) => {
    set((state) => ({
      artifacts: {
        ...state.artifacts,
        [nodeId]: (state.artifacts[nodeId] ?? []).filter((a) => a.id !== artifactId),
      },
    }))
  },

  fetchTrash: async () => {
    try {
      const res = await fetch('/api/attachments/trash')
      if (!res.ok) throw new Error('Failed to fetch trash')
      const data: Artifact[] = await res.json()
      set({ trashedArtifacts: data })
    } catch (err) {
      console.error('fetchTrash error:', err)
    }
  },

  restoreArtifact: async (artifact: Artifact) => {
    try {
      const res = await fetch(`/api/attachments/${artifact.id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to restore artifact')
      const restored: Artifact = await res.json()
      set((state) => ({
        trashedArtifacts: state.trashedArtifacts.filter((a) => a.id !== artifact.id),
        artifacts: {
          ...state.artifacts,
          [artifact.node_id]: [...(state.artifacts[artifact.node_id] ?? []), restored],
        },
      }))
    } catch (err) {
      console.error('restoreArtifact error:', err)
    }
  },

  setShowTrash: (show: boolean) => set({ showTrash: show }),
}))
