"use client"
// apps/web/src/app/(protected)/ai/knowledge-graph/components/kg-entity-list.tsx

import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import type { KgEntity } from "@/types/api"

const ENTITY_TYPES = ["", "person", "company", "project", "concept", "location", "date"]

const TYPE_COLORS: Record<string, string> = {
  person:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  company:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  project:  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  concept:  "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  location: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  date:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
}

interface Props {
  entities: KgEntity[]
  isLoading: boolean
  selectedId: string | null
  typeFilter: string
  q: string
  onSelectType: (t: string) => void
  onQueryChange: (q: string) => void
  onSelect: (id: string) => void
}

export function KgEntityList({
  entities, isLoading, selectedId, typeFilter, q,
  onSelectType, onQueryChange, onSelect,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search entities..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1 p-2 border-b">
        {ENTITY_TYPES.map((t) => (
          <button
            key={t || "all"}
            onClick={() => onSelectType(t)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              typeFilter === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted-foreground/30 hover:bg-muted"
            }`}
          >
            {t || "all"}
          </button>
        ))}
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {!isLoading && entities.length === 0 && (
          <p className="text-xs text-muted-foreground p-4 text-center">
            No entities found. Ingest Nextcloud documents first.
          </p>
        )}
        {!isLoading && entities.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={`w-full text-left px-3 py-2 border-b hover:bg-muted/50 transition-colors ${
              selectedId === e.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[e.entity_type] ?? "bg-muted text-muted-foreground"}`}>
                {e.entity_type}
              </span>
              <span className="text-sm truncate font-medium">{e.name}</span>
            </div>
            {e.source_count != null && (
              <p className="text-xs text-muted-foreground mt-0.5 pl-0.5">
                {e.source_count} source{e.source_count !== 1 ? "s" : ""}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
