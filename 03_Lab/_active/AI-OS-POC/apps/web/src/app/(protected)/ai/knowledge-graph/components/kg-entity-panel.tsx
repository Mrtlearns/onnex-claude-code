"use client"
// apps/web/src/app/(protected)/ai/knowledge-graph/components/kg-entity-panel.tsx
// Entity drilldown: name, type, aliases, relationships, source docs

import type { KgEntityDetail } from "@/types/api"
import { ExternalLink } from "lucide-react"

interface Props {
  detail: KgEntityDetail
  onSelectEntity: (id: string) => void
}

export function KgEntityPanel({ detail, onSelectEntity }: Props) {
  const { entity, relationships, source_docs } = detail

  return (
    <div className="space-y-5">
      {/* Entity header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{entity.entity_type}</p>
        <h2 className="text-xl font-semibold mt-0.5">{entity.name}</h2>
        {entity.aliases?.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            Also known as: {entity.aliases.join(", ")}
          </p>
        )}
      </div>

      {/* Properties */}
      {entity.properties && Object.keys(entity.properties).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Properties</h3>
          <div className="rounded-lg border text-xs divide-y">
            {Object.entries(entity.properties).map(([k, v]) => (
              <div key={k} className="flex gap-4 px-3 py-1.5">
                <span className="text-muted-foreground shrink-0 w-28 truncate">{k}</span>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {relationships.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Relationships ({relationships.length})</h3>
          <div className="space-y-2">
            {relationships.map((rel) => (
              <div key={rel.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rel.rel_type}</span>
                  <button
                    onClick={() => onSelectEntity(rel.to_id)}
                    className="font-medium text-primary hover:underline truncate"
                  >
                    {rel.to_name}
                  </button>
                  <span className="text-xs text-muted-foreground">({rel.to_type})</span>
                </div>
                {rel.context && (
                  <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">
                    "{rel.context}"
                  </p>
                )}
                {rel.source_path && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {rel.source_path.split("/").pop()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source documents */}
      {source_docs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Source Documents ({source_docs.length})</h3>
          <div className="space-y-1">
            {source_docs.map((doc) => (
              <a
                key={doc.file_path}
                href={`/documents?path=${encodeURIComponent(doc.file_path)}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{doc.file_name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
