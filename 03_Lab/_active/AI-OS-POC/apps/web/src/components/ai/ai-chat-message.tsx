"use client"
// apps/web/src/components/ai/ai-chat-message.tsx
// Single chat message bubble with optional source reference chips

import Link from "next/link"
import { Bot, ExternalLink } from "lucide-react"
import type { AiMessage, AiSourceRef } from "@/types/api"

function sourceRefHref(ref: AiSourceRef): string {
  switch (ref.entity_type) {
    case "client":
      return `/clients/${ref.entity_id}`
    case "project":
      return `/projects/${ref.entity_id}`
    case "document":
      return `/documents?highlight=${ref.entity_id}`
    case "deal":
      return `/deals/${ref.entity_id}`
    case "task":
      return `/tasks/${ref.entity_id}`
    default:
      return "#"
  }
}

interface AiChatMessageProps {
  message: AiMessage
}

export function AiChatMessage({ message }: AiChatMessageProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
          {message.content}
        </div>
        {message.source_refs && message.source_refs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.source_refs.map((ref, i) => (
              <Link
                key={i}
                href={sourceRefHref(ref)}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {ref.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
