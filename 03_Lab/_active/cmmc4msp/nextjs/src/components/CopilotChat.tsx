'use client'
import { useState, useRef, useEffect } from 'react'
import {
  SparklesIcon,
  PaperAirplaneIcon,
  TrashIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface CopilotChatProps {
  programId: string
  controlId: string
  accessToken: string
  onArtifactCreated?: () => void
}

export function CopilotChat({ programId, controlId, accessToken, onArtifactCreated }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingInterview, setSavingInterview] = useState(false)
  const [saveToast, setSaveToast] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const API = process.env.NEXT_PUBLIC_API_URL || ''
  const apiBase = `${API}/api/controls/program/${programId}/${controlId}/chat`

  useEffect(() => {
    loadHistory()
  }, [programId, controlId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadHistory() {
    setLoading(true)
    try {
      const res = await fetch(apiBase, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }])
    setStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: userMsg }),
      })

      if (!res.ok || !res.body) throw new Error('Stream error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            if (payload === '[DONE]') continue
            try {
              const { content } = JSON.parse(payload)
              if (content) {
                fullContent += content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  )
                )
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Error: Failed to get response. Please try again.' }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  async function clearHistory() {
    await fetch(apiBase, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    setMessages([])
  }

  async function saveAsEvidence() {
    if (savingInterview) return
    setSavingInterview(true)
    try {
      const res = await fetch(
        `${API}/api/controls/program/${programId}/${controlId}/finalize-interview`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      if (res.ok) {
        setSaveToast(true)
        setTimeout(() => setSaveToast(false), 4000)
        onArtifactCreated?.()
      }
    } finally {
      setSavingInterview(false)
    }
  }

  return (
    <div className="flex flex-col h-[500px] border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Compliance Copilot</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length >= 2 && (
            <button
              onClick={saveAsEvidence}
              disabled={savingInterview}
              title="Save interview as evidence artifact"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <ArchiveBoxArrowDownIcon className="w-3.5 h-3.5" />
              {savingInterview ? 'Saving…' : 'Save as Evidence'}
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <TrashIcon className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Save toast */}
      {saveToast && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700 font-medium">
          Interview saved as evidence — queued for assessment
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {loading ? (
          <p className="text-sm text-gray-400 text-center">Loading conversation...</p>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 mt-8">
            <SparklesIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Ask me anything about this control.</p>
            <p className="mt-1 text-xs">
              I can explain requirements, suggest evidence types, and cite your existing artifacts.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse delay-100">●</span>
                    <span className="animate-pulse delay-200">●</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about this control..."
            disabled={streaming}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
