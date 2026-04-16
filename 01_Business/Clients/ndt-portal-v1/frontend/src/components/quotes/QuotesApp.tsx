import { useEffect, useState, useMemo } from 'react'
import { quotesApi } from '@/lib/quotesApi'
import { useAuth } from '@/contexts/AuthContext'
import { type QuoteRow, type QuoteType, UtQuoteDetailDialog, RtQuoteDetailDialog, AuditLogDialog } from './QuoteDetailPanel'
import QuoteList from './QuoteList'

export default function QuotesApp() {
  const { accessToken } = useAuth()
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<QuoteType>('ut')
  const [auditIntakeId, setAuditIntakeId] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    quotesApi.list()
      .then(data => { setQuotes(data); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : String(e)); setLoading(false) })
  }, [accessToken])

  const filtered = useMemo(() => {
    return quotes.filter(q => {
      if (filterSource !== 'all' && q.source !== filterSource) return false
      if (filterStatus !== 'all' && q.status !== filterStatus) return false
      if (filterType !== 'all' && q.quote_type !== filterType) return false
      if (search && !q.customer_name.toLowerCase().includes(search.toLowerCase()) &&
          !q.quote_number.toLowerCase().includes(search.toLowerCase()) &&
          !(q.part_number ?? '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [quotes, filterSource, filterStatus, filterType, search])

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading quotes…</div>
  if (error)   return <div className="p-8 text-destructive">Failed to load quotes: {error}</div>

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Quote History</h2>
        <p className="text-sm text-muted-foreground mt-1">{quotes.length} quotes · UT + RT</p>
      </div>

      <QuoteList
        quotes={quotes}
        filtered={filtered}
        search={search}
        filterSource={filterSource}
        filterStatus={filterStatus}
        filterType={filterType}
        onSearchChange={setSearch}
        onFilterSourceChange={setFilterSource}
        onFilterStatusChange={setFilterStatus}
        onFilterTypeChange={setFilterType}
        onSelectQuote={(id, type) => { setSelectedId(id); setSelectedType(type) }}
        onAuditClick={setAuditIntakeId}
      />

      {selectedId && selectedType === 'ut' && (
        <UtQuoteDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {selectedId && selectedType === 'rt' && (
        <RtQuoteDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {auditIntakeId && (
        <AuditLogDialog intakeId={auditIntakeId} onClose={() => setAuditIntakeId(null)} />
      )}
    </div>
  )
}
