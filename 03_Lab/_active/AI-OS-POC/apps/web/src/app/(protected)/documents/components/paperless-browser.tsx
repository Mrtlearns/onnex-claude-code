"use client"
// apps/web/src/app/(protected)/documents/components/paperless-browser.tsx
// Calls /api/bff/paperless (BFF proxy) — no direct Paperless credentials in browser

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaperlessDocument } from "@/types/api"

interface PaperlessBrowserProps {
  onSelect: (doc: PaperlessDocument) => void
}

export function PaperlessBrowser({ onSelect }: PaperlessBrowserProps) {
  const { data: documents = [], isLoading, isError } = useQuery<PaperlessDocument[]>({
    queryKey: ["paperless-documents"],
    queryFn: () =>
      fetch("/api/bff/paperless")
        .then((r) => r.json())
        .then((d) => d.results ?? []),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Could not connect to Paperless-ngx
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        No documents found in Paperless-ngx
      </div>
    )
  }

  return (
    <div className="space-y-2 p-2 overflow-auto">
      {documents.map((doc) => (
        <Card
          key={doc.id}
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onSelect(doc)}
        >
          <CardContent className="p-3 space-y-1">
            <p className="text-sm font-medium leading-tight line-clamp-2">{doc.title}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(doc.created).toLocaleDateString()}
              {doc.correspondent ? ` · ${doc.correspondent}` : ""}
            </p>
            {doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {doc.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
