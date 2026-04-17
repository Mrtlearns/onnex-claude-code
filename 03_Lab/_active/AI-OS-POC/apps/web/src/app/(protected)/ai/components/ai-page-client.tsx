"use client"
// apps/web/src/app/(protected)/ai/components/ai-page-client.tsx
// Full-page AI Assistant — chat interface + admin memory panel

import { useState, useEffect, useRef } from "react"
import { Bot, Send, Trash2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AiChatMessage } from "@/components/ai/ai-chat-message"
import type { Session } from "next-auth"
import type { AiMessage, AiMemoryStats } from "@/types/api"

interface Props { session: Session | null }

function isAdmin(session: Session | null) {
  const role = (session?.user as any)?.role
  return role === "super_admin" || role === "admin"
}

export function AiPageClient({ session }: Props) {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const { data: memStats } = useQuery<AiMemoryStats>({
    queryKey: ["ai-memory-stats"],
    queryFn: () => fetch("/api/bff/ai/memory").then((r) => r.json()),
    enabled: isAdmin(session),
    staleTime: 60_000,
  })

  const clearMemory = useMutation({
    mutationFn: () => fetch("/api/bff/ai/memory", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-memory-stats"] }),
  })

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const query = input.trim()
    if (!query || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: query }])
    setLoading(true)
    try {
      const res = await fetch("/api/bff/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response ?? "No response.", source_refs: data.source_refs ?? [] },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "AI is currently unavailable. Please try again.", source_refs: [] },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="flex h-full gap-0">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">AI Assistant</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <Bot className="h-12 w-12 opacity-20" />
              <div className="text-center max-w-md">
                <p className="text-sm font-medium mb-2">Ask anything about your workspace</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    "What are the top client risks this week?",
                    "Summarize everything for Acme.",
                    "Find the latest signed contract.",
                    "What tasks are overdue?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setInput(prompt); }}
                      className="text-left rounded-lg border px-3 py-2 hover:bg-muted transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <AiChatMessage key={i} message={msg} />
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4 text-muted-foreground animate-pulse" />
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-6 py-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Admin memory panel */}
      {isAdmin(session) && (
        <div className="w-64 border-l flex flex-col">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Memory</h2>
          </div>
          <div className="flex-1 px-4 py-4 space-y-3">
            {memStats ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Entries</p>
                  <p className="text-lg font-semibold">{memStats.entry_count.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vector storage</p>
                  <p className="text-sm font-medium">
                    {(memStats.vector_storage_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Loading stats...</p>
            )}
          </div>
          <div className="border-t px-4 py-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-2"
              disabled={clearMemory.isPending}
              onClick={() => {
                if (confirm("Clear all AI memory? This cannot be undone.")) {
                  clearMemory.mutate()
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Clear memory
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
