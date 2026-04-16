# Knowledge Universe — Design Spec

> Original spec provided by Mr. T from Claude Chat (2026-03-29).
> This is the source of truth for intended features. Current implementation covers the MVP.

---

## Concept

A personal knowledge management tool where knowledge items ("nodes") exist as glowing 3D spheres
in a navigable universe. The visual metaphor: your knowledge base as a cosmos — active knowledge
glows bright, neglected knowledge dims and greys out over time.

Two views of the same data:
- **Universe View** — spatial, immersive, emotional
- **Mindmap View** — structured, relational, analytical

---

## Node Types

| Type | Icon | Size | Purpose |
|------|------|------|---------|
| `note` | 📝 | 60px | General notes and thoughts |
| `task` | ✅ | 60px | Actionable items |
| `idea` | 💡 | 70px | Concepts and hypotheses |
| `reference` | 🔗 | 60px | External sources and docs |
| `person` | 👤 | 75px | People and contacts |
| `project` | 📁 | 90px | Projects and initiatives |

---

## Edge Types

| Type | Meaning |
|------|---------|
| `relates_to` | General connection |
| `depends_on` | Dependency relationship |
| `blocks` | One node blocks another |
| `part_of` | Composition / hierarchy |
| `caused_by` | Causal relationship |

Edge strength (0–1) controls line thickness in both views.

---

## Aging State Machine

Nodes age based on `last_accessed_at` timestamp:

```
fresh (< 7d)  →  aging (7-30d)  →  urgent (30-90d)  →  catchall (>90d)
  #4ade80           #facc15           #f97316            #94a3b8
  green glow        yellow glow       orange glow        grey/dim
```

- Recalculated lazily on each fetch (not a background cron)
- `last_accessed_at` updates whenever a node is viewed individually (GET /api/nodes/[id])
- The glow effect is the primary visual indicator — catchall nodes should feel "cold"

---

## Universe View — CSS 3D (no Three.js)

```
Container:  perspective: 1000px, transform-style: preserve-3d
Spheres:    position absolute, border-radius: 50%, radial gradient lighting effect
3D pos:     CSS translate3d(x, y, z) from node.x, node.y, node.z
Glow:       box-shadow: 0 0 20px 5px <aging-color>
Lines:      SVG overlay, lines between projected 2D center positions
Rotate:     Drag on container rotates the scene (mousedown + mousemove)
Label:      Glassmorphic pill below each sphere showing node title
Select:     Click → opens NodePanel slide-in
```

Desired feel: stars in space. Nodes float with slight parallax, connections glow faintly.

---

## Mindmap View — React Flow

- Custom node type matching sphere styling (colored by aging status)
- Dark theme, smoothstep edges
- Controls + MiniMap
- Same NodePanel on click

---

## Glassmorphism Design System

```css
/* Glass surface */
backdrop-filter: blur(16px) saturate(180%);
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.15);
border-radius: 16px;

/* Space background */
background: radial-gradient(ellipse at center, #0d1117 0%, #020408 100%);

/* Starfield: random white dots scattered across the background */
```

---

## Auth

- Single-user JWT auth (cookie `ku_session`, 7-day maxAge)
- `ADMIN_USERNAME` + `ADMIN_PASSWORD` from env
- Middleware protects all routes except `/login`, `/api/auth/*`, `/embed`
- API routes return `401 JSON` (not redirect) on missing auth

---

## AI Assistant

- Endpoint: `POST /api/ai`
- Body: `{ query: string, context_node_ids?: string[] }`
- Fetches referenced nodes, sends to OpenRouter (`anthropic/claude-haiku`)
- System prompt: "You are a knowledge assistant. The user has a knowledge universe..."
- Streams response back
- Logs to `action_logs` as `ai.query`

---

## iframe Embed + postMessage Bridge

The `/embed` route renders a minimal universe view designed for embedding in other apps
(future: embed in PI Lawyer OS, AI-OS POC, etc.).

Inbound (parent → iframe):
```js
{ type: 'KU_SELECT_NODE', nodeId: string }
{ type: 'KU_CREATE_NODE', data: {...} }
{ type: 'KU_GET_NODES' }
```

Outbound (iframe → parent):
```js
{ type: 'KU_NODE_SELECTED', node }
{ type: 'KU_NODE_CREATED', node }
{ type: 'KU_NODES_RESULT', nodes }
```

---

## Two-Tier Logging

1. **pino** — structured application logs to stdout (container logs)
2. **action_logs table** — DB-persisted audit trail

`action_logs` entries:
- `node.created`, `node.updated`, `node.deleted`
- `edge.created`, `edge.deleted`
- `ai.query`
- `attachment.uploaded`

---

## DB Schema Summary

```sql
poc_personal_to_do.nodes          -- id, title, content, type, status, x, y, z, color,
                                  -- tags, metadata, is_public, archived, timestamps
poc_personal_to_do.edges          -- id, source_id, target_id, label, type, strength
poc_personal_to_do.node_attachments -- id, node_id, filename, storage_path, mime_type, size_bytes
poc_personal_to_do.action_logs    -- id, action, entity_type, entity_id, payload, created_at
```

---

## Future Features (Not Yet Built)

- [ ] AI-suggested connections between nodes (auto-edge creation)
- [ ] Node search / filter by type, status, tag
- [ ] Keyboard shortcuts (n = new node, e = new edge, esc = deselect)
- [ ] Node comments / threaded notes
- [ ] Export to JSON / markdown
- [ ] Import from Obsidian / Notion
- [ ] Multi-user / shared universes (is_public flag already in schema)
- [ ] Mobile touch controls for universe rotation
- [ ] Node templates (quick-create from type presets)
- [ ] Scheduled aging notifications (n8n webhook)
