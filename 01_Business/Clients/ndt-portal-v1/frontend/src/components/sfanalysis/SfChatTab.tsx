import { useState, useRef, useEffect } from 'react'
import { sfAnalysisApi } from '@/lib/sfAnalysisApi'
import { Send, Loader2, Bot, AlertTriangle, ChevronDown } from 'lucide-react'

const SAMPLE_PROMPTS = [
  'List all RT jobs for Boeing in the last 12 months',
  'Which customers have the most work orders?',
  'Show all parts inspected using Ir192',
  'Average invoice amount by service type',
  'Open quotes expiring in 30 days',
  'Revenue by market segment',
]

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  columns?: string[]
  results?: Record<string, unknown>[]
  error?: string
}

function ResultTable({ columns, results }: { columns: string[]; results: Record<string, unknown>[] }) {
  if (!results.length) return <p className="text-xs text-muted-foreground">No rows returned</p>
  return (
    <div className="overflow-auto max-h-60 border rounded mt-2">
      <table className="w-full text-xs">
        <thead className="bg-muted/70 sticky top-0">
          <tr>
            {columns.map(c => (
              <th key={c} className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {results.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {columns.map(c => (
                <td key={c} className="px-2 py-1.5 whitespace-nowrap">
                  {row[c] == null ? <span className="text-muted-foreground">NULL</span> : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SqlDisclosure({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false)
  return (
    <details
      open={open}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-2 text-xs"
    >
      <summary className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground select-none">
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
        SQL
      </summary>
      <pre className="mt-1 p-2 bg-muted rounded overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {sql}
      </pre>
    </details>
  )
}

function AssistantBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl rounded-bl-sm px-3 py-2.5 bg-muted text-foreground text-sm">
        {msg.error ? (
          <div className="flex items-start gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="text-xs">{msg.error}</span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        )}

        {msg.sql && <SqlDisclosure sql={msg.sql} />}

        {msg.columns && msg.results && !msg.error && (
          <ResultTable columns={msg.columns} results={msg.results} />
        )}
      </div>
    </div>
  )
}

export default function SfChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)

    // Strip sql/columns/results metadata — only send role+content to API
    const apiMessages = next.map(m => ({ role: m.role, content: m.content }))

    try {
      const data = await sfAnalysisApi.chat(apiMessages)

      if (data.error) {
        setError(data.error)
        return
      }

      const assistantMsg: ChatMessage = {
        role:        'assistant',
        content:     data.explanation ?? '',
        sql:         data.sql,
        columns:     data.columns,
        results:     data.results,
        error:       data.error,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Bot className="h-4 w-4 text-indigo-500" />
        <span className="font-semibold text-sm">SF Chat</span>
        <span className="ml-auto text-xs text-muted-foreground">Powered by Claude · sf.* schema</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Ask anything about your Salesforce data. Try a sample:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-left text-xs px-3 py-2 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl rounded-br-sm px-3 py-2 bg-indigo-600 text-white text-sm">
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ) : (
            <AssistantBubble key={i} msg={m} />
          )
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2">
              <div className="flex gap-1 items-center py-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t shrink-0">
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); send(input) }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your SF data…"
            className="flex-1 text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
