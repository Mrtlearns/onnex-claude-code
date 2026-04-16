import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { adminApi } from '@/lib/adminApi'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Bot, X, Send, Loader2 } from 'lucide-react'
import type { AnalyticsResponse, ChartSpec } from './AnalyticsDashboard'

const SAMPLE_PROMPTS = [
  'Show revenue trend for the last 6 months',
  'Which customers have the highest quote value? Visualize it.',
  "What's our win rate trend month by month?",
  'Break down SF revenue by service type',
  'Compare UT vs RT quote volumes this quarter',
]

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#8b5cf6', '#f97316']

interface Message {
  role: 'user' | 'assistant'
  content: string
  chartSpec?: ChartSpec | null
}

function InlineChart({ spec }: { spec: ChartSpec }) {
  const { type, title, data, xKey, yKeys } = spec
  if (!data?.length || !yKeys?.length) return null

  return (
    <div className="mt-3 rounded-lg border bg-card p-3">
      {title && <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={200}>
        {type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            {yKeys.map((yk, i) => (
              <Bar key={yk.key} dataKey={yk.key} name={yk.label} fill={yk.color ?? PIE_COLORS[i % PIE_COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            {yKeys.map((yk, i) => (
              <Line key={yk.key} type="monotone" dataKey={yk.key} name={yk.label} stroke={yk.color ?? PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            {yKeys.map((yk, i) => (
              <Area key={yk.key} type="monotone" dataKey={yk.key} name={yk.label} stroke={yk.color ?? PIE_COLORS[i % PIE_COLORS.length]} fill={yk.color ?? PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.2} />
            ))}
          </AreaChart>
        ) : type === 'pie' ? (
          <PieChart>
            <Pie data={data} dataKey={yKeys[0].key} nameKey={xKey} cx="50%" cy="50%" outerRadius={80}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : (
          <BarChart data={data}>
            <Bar dataKey={yKeys[0].key} fill={PIE_COLORS[0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

interface Props {
  analyticsData: AnalyticsResponse | null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AiAssistant({ analyticsData }: Props) {
  const [open, setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const data = await adminApi.aiQuery(userMsg.content)
      if (data.error) {
        setError(data.error)
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply ?? '',
          chartSpec: data.chartSpec ?? null,
        }])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-colors"
        title="AI Assistant"
        aria-label="AI Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed right-0 top-0 bottom-0 w-96 z-40 flex flex-col bg-background border-l border-border shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <Bot className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold text-sm">AI Data Assistant</span>
            <span className="ml-auto text-xs text-muted-foreground">Powered by Claude</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1 mb-3">
                  Ask me anything about your NDT Portal data. Try a sample:
                </p>
                {SAMPLE_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full text-left text-xs px-3 py-2 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={[
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm',
                  ].join(' ')}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="markdown-reply text-sm">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mt-1.5 mb-0.5">{children}</h3>,
                          p:  ({ children }) => <p className="mb-1.5 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                          hr: () => <hr className="border-current opacity-20 my-2" />,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {m.chartSpec && <InlineChart spec={m.chartSpec} />}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2">
                  <LoadingDots />
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
          <div className="px-3 py-3 border-t border-border shrink-0">
            <form
              className="flex gap-2"
              onSubmit={e => { e.preventDefault(); send(input) }}
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about your data…"
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
      )}
    </>
  )
}
