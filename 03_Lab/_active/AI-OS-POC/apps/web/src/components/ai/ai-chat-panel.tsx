"use client"
// apps/web/src/components/ai/ai-chat-panel.tsx
// Persistent AI chat panel — Bot icon in header opens Sheet from right
// Supports two modes: Workspace Memory (ai/chat) and Nextcloud Documents (rag/chat)

import { useState, useEffect, useRef } from "react"
import { Bot, Send, X, FileText, Database } from "lucide-react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AiChatMessage } from "./ai-chat-message"
import type { AiMessage } from "@/types/api"

type ChatMode = "workspace" | "nextcloud"

const SCOPE_OPTIONS = [
  { value: "", label: "All Nextcloud" },
  { value: "GDrive-Sync/04 Clients", label: "04 Clients (all)" },
  { value: "GDrive-Sync/04 Clients/NDT Non Destructive Testing", label: "NDT" },
  { value: "GDrive-Sync/04 Clients/THIMS", label: "THIMS" },
  { value: "GDrive-Sync/04 Clients/TFCWC", label: "TFCWC" },
  { value: "GDrive-Sync/04 Clients/Airgap Labs", label: "Airgap Labs" },
  { value: "GDrive-Sync/02 Agents", label: "02 Agents" },
  { value: "GDrive-Sync/03 Articles", label: "03 Articles" },
  { value: "GDrive-Sync/07 Sales AI", label: "07 Sales AI" },
]

export function AIChatPanel() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ChatMode>("workspace")
  const [scope, setScope] = useState("")
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Reset messages when mode changes
  useEffect(() => {
    setMessages([])
  }, [mode])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const query = input.trim()
    if (!query || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: query }])
    setLoading(true)

    try {
      const endpoint = mode === "nextcloud" ? "/api/bff/rag/chat" : "/api/bff/ai/chat"
      const body = mode === "nextcloud"
        ? { query, scope: scope || undefined }
        : { query }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error("AI request failed")

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response ?? "No response received.",
          source_refs: data.source_refs ?? [],
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, AI is currently unavailable. Please try again.",
          source_refs: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const placeholder = mode === "nextcloud"
    ? "Ask about Nextcloud documents..."
    : "Ask anything about your workspace..."

  const emptyText = mode === "nextcloud"
    ? "Search across Nextcloud documents — select a scope to narrow to a client or folder."
    : "Ask anything about your workspace — clients, projects, tasks, deals, or documents."

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Open AI Assistant"
        >
          <Bot className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg p-0">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              AI Assistant
            </SheetTitle>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Close AI Assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 mt-2">
            <Button
              variant={mode === "workspace" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setMode("workspace")}
            >
              <Database className="h-3.5 w-3.5" />
              Workspace Memory
            </Button>
            <Button
              variant={mode === "nextcloud" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => setMode("nextcloud")}
            >
              <FileText className="h-3.5 w-3.5" />
              Nextcloud Docs
            </Button>
          </div>

          {/* Scope selector — only in nextcloud mode */}
          {mode === "nextcloud" && (
            <div className="mt-2">
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Scope: All Nextcloud" />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SheetHeader>

        {/* Message thread */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-8">
              {emptyText}
            </p>
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

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t px-4 py-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
