"use client"

// ─────────────────────────────────────────────────────────────────────────────
// EntityInspector — detail panel for a selected knowledge graph entity
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment } from "react"
import type { BrainEntity, BrainLink } from "./types"

interface EntityInspectorProps {
  entity: BrainEntity | null
  links: BrainLink[]
  entities: BrainEntity[]
  className?: string
}

export function EntityInspector({ entity, links, entities, className }: EntityInspectorProps) {
  if (!entity) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 ${className ?? ""}`}>
        <span className="text-2xl opacity-30">◎</span>
        <p>Click a node to inspect</p>
      </div>
    )
  }

  const entityMap = new Map(entities.map((e) => [e.id, e]))

  const outgoing = links.filter((l) => l.source === entity.id)
  const incoming = links.filter((l) => l.target === entity.id)

  const props = entity.properties
    ? Object.entries(entity.properties).filter(([, v]) => v !== null && v !== "")
    : []

  return (
    <div className={`flex flex-col gap-4 p-1 text-sm overflow-y-auto ${className ?? ""}`}>
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
          {entity.entity_type}
        </p>
        <h3 className="font-semibold text-base leading-tight">{entity.name}</h3>
        {entity.aliases?.length ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            a.k.a. {entity.aliases.join(", ")}
          </p>
        ) : null}
      </div>

      {/* Properties */}
      {props.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Properties</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {props.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-muted-foreground truncate">{k}</dt>
                <dd className="truncate">{String(v)}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}

      {/* Sources */}
      {entity.source_count != null && (
        <div className="text-xs text-muted-foreground">
          {`${entity.source_count} source document${entity.source_count !== 1 ? "s" : ""}`}
          {entity.folder_scope && <span> · {entity.folder_scope}</span>}
        </div>
      )}

      {/* Connections */}
      {(outgoing.length > 0 || incoming.length > 0) && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Connections ({outgoing.length + incoming.length})
          </p>
          <ul className="space-y-1">
            {outgoing.map((l, i) => {
              const target = entityMap.get(l.target)
              return (
                <li key={`out-${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-muted-foreground mt-0.5">→</span>
                  <span>
                    <span className="text-muted-foreground">{l.rel_type}</span>{" "}
                    <span className="font-medium">{target?.name ?? l.target}</span>
                  </span>
                </li>
              )
            })}
            {incoming.map((l, i) => {
              const source = entityMap.get(l.source)
              return (
                <li key={`in-${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-muted-foreground mt-0.5">←</span>
                  <span>
                    <span className="font-medium">{source?.name ?? l.source}</span>{" "}
                    <span className="text-muted-foreground">{l.rel_type}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
