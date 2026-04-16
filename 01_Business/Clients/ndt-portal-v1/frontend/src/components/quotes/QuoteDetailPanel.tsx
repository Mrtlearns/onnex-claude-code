/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClipboardList, ChevronDown, ChevronUp, Download, Pencil, Eye, Box } from 'lucide-react'
import ExecutionLogViewer from '@/components/analysis/ExecutionLogViewer'
import { getAuthHeaders } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────
export type Source = 'api' | 'salesforce' | 'email' | 'portal'
export type Status = 'calculated' | 'pending' | 'sent' | 'accepted' | 'rejected'
export type QuoteType = 'ut' | 'rt'

export interface QuoteRow {
  id: string
  quote_number: string
  customer_name: string
  source: Source
  grand_total: number | string
  status: Status
  created_at: string
  intake_id?: string | null
  quote_type: QuoteType
  part_number?: string | null
}

interface UtQuoteDetail {
  id: string
  quote_number: string
  source: Source
  customer_name: string
  notes: string | null
  status: Status
  grand_total: number
  created_at: string
  pdf_version: number
  pdf_path: string | null
  response_body: { items: QuoteLineItem[]; summary: QuoteSummary }
}

interface RtQuoteDetail {
  id: string
  quote_number: string
  source: Source
  part_number: string
  customer_name: string
  notes: string | null
  status: Status
  grand_total: number
  created_at: string
  pdf_version: number
  pdf_path: string | null
  response_body: {
    totals?: { totalLabor: number; totalFilm: number; totalPrice: number }
    views?: Array<{ viewNumber: number; shotTypeLabel: string; qtyPartsPerFilm: number; filmSize?: { label: string }; costs?: { pricePerView: number; laborCost: number; filmCostPerPart: number } }>
    tierComparison?: Array<{ tierLabel: string; grandTotal: number; isRecommended: boolean }>
  }
}

interface QuoteLineItem {
  partNumber?: string
  description?: string
  geometryType: string
  dimensions: Record<string, number>
  scanParameters: { scanIndex: number; loadTime: number; hourlyRate: number; indexes: number; secPerScanline: number; scanTimeMin: number; totalTimeMin: number }
  pricing: { timePricePart: number; weightPricePart: number | null; effectivePricePart: number; quantity: number; extPrice: number; lotCharge: number; techFee: number; subTotal: number; envFee: number; grandTotal: number }
}

interface QuoteSummary {
  itemCount: number; totalParts: number; totalGrand: number
  totalTechFees: number; totalEnvFees: number; deliveryFee: string; leadTime: string
}

// ── Badge configs ──────────────────────────────────────────────────────────────
export const SOURCE_STYLE: Record<Source, string> = {
  api:        'bg-blue-100 text-blue-800',
  portal:     'bg-green-100 text-green-800',
  salesforce: 'bg-purple-100 text-purple-800',
  email:      'bg-amber-100 text-amber-800',
}

export const STATUS_STYLE: Record<Status, string> = {
  calculated: 'bg-slate-100 text-slate-700',
  pending:    'bg-amber-100 text-amber-700',
  sent:       'bg-blue-100 text-blue-700',
  accepted:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
}

export const STATUSES: Status[] = ['calculated', 'pending', 'sent', 'accepted', 'rejected']

export function fmt(n: number | string) {
  return '$' + parseFloat(String(n)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── PDF helpers ────────────────────────────────────────────────────────────────
async function generateAndDownloadPdf(quoteType: QuoteType, id: string, quoteNumber: string) {
  await fetch(`/api/${quoteType}/quote/${id}/pdf`, { method: 'POST', headers: getAuthHeaders() })
  const res = await fetch(`/api/${quoteType}/quote/${id}/pdf`, { headers: getAuthHeaders() })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${quoteNumber}.pdf`; a.click()
  URL.revokeObjectURL(url)
}

async function generateAndPreviewPdf(quoteType: QuoteType, id: string, setPdfBlobUrl: (url: string) => void, setPdfExpanded: (v: boolean) => void) {
  await fetch(`/api/${quoteType}/quote/${id}/pdf`, { method: 'POST', headers: getAuthHeaders() })
  const res = await fetch(`/api/${quoteType}/quote/${id}/pdf`, { headers: getAuthHeaders() })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  setPdfBlobUrl(url)
  setPdfExpanded(true)
}

// ── UT Quote detail dialog ─────────────────────────────────────────────────────
function UtQuoteDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<UtQuoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<Status>('calculated')
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfVersion, setPdfVersion] = useState(0)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfExpanded, setPdfExpanded] = useState(false)

  useEffect(() => { return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) } }, [pdfBlobUrl])

  function load() {
    fetch(`/api/ut/quote/${id}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); setEditName(d.customer_name ?? ''); setEditStatus(d.status); setPdfVersion(d.pdf_version ?? 0) })
      .catch(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable
  useEffect(() => { load() }, [id])

  function toggleItem(i: number) {
    setExpanded(prev => { const next = new Set(prev); if (next.has(i)) { next.delete(i) } else { next.add(i) } return next })
  }

  async function handleSave() {
    if (!detail) return
    setSaving(true)
    try {
      await fetch(`/api/ut/quote/${id}`, { method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ customerName: editName, status: editStatus }) })
      setEditing(false); load()
    } finally { setSaving(false) }
  }

  async function handlePdf() {
    if (!detail) return
    setPdfLoading(true)
    try { await generateAndDownloadPdf('ut', id, detail.quote_number); load() }
    finally { setPdfLoading(false) }
  }

  async function handlePreview() {
    if (pdfBlobUrl) { setPdfExpanded(prev => !prev); return }
    setPdfLoading(true)
    try { await generateAndPreviewPdf('ut', id, setPdfBlobUrl, setPdfExpanded); load() }
    finally { setPdfLoading(false) }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); setPdfExpanded(false); onClose() } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        {loading && <p className="py-8 text-center text-muted-foreground">Loading…</p>}
        {!loading && !detail && <p className="py-8 text-center text-destructive">Failed to load quote.</p>}
        {detail && (() => {
          const { items, summary } = detail.response_body
          return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  {detail.quote_number}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_STYLE[detail.source]}`}>{detail.source}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">UT</span>
                  {pdfVersion > 0 && <span className="text-xs text-muted-foreground">PDF v{pdfVersion}</span>}
                </DialogTitle>
              </DialogHeader>

              {editing ? (
                <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
                  <div className="flex gap-2">
                    <div className="flex-1"><p className="text-xs text-muted-foreground mb-1">Customer Name</p><Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" /></div>
                    <div><p className="text-xs text-muted-foreground mb-1">Status</p>
                      <select className="border rounded-md px-2 py-1.5 text-sm bg-background h-8" value={editStatus} onChange={e => setEditStatus(e.target.value as Status)}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[detail.status]}`}>{detail.status}</span>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs ml-auto" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" />Edit</Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={pdfLoading} onClick={handlePdf}><Download className="h-3 w-3" />{pdfLoading ? 'Generating…' : 'Download PDF'}</Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={pdfLoading} onClick={handlePreview}><Eye className="h-3 w-3" />{pdfExpanded ? 'Hide PDF' : 'View PDF'}</Button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="rounded-lg border bg-muted/30 p-3 text-center"><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-bold text-lg">{fmt(summary.totalGrand)}</p></div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center"><p className="text-xs text-muted-foreground">Parts</p><p className="font-bold text-lg">{summary.totalParts}</p></div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center"><p className="text-xs text-muted-foreground">Lead Time</p><p className="font-bold text-sm leading-tight mt-1">{summary.leadTime}</p></div>
              </div>

              {(summary.totalTechFees > 0 || summary.totalEnvFees > 0) && (
                <div className="flex gap-4 text-sm text-muted-foreground px-1">
                  {summary.totalTechFees > 0 && <span>Tech fees: {fmt(summary.totalTechFees)}</span>}
                  {summary.totalEnvFees > 0 && <span>Env fees: {fmt(summary.totalEnvFees)}</span>}
                  {summary.deliveryFee !== 'No' && <span>Delivery: {summary.deliveryFee}</span>}
                </div>
              )}

              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{items.length} Line Item{items.length !== 1 ? 's' : ''}</p>
                {items.map((item, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors" onClick={() => toggleItem(i)}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                        <div>
                          <span className="font-medium text-sm">{item.partNumber || <span className="text-muted-foreground italic">No part#</span>}</span>
                          <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.geometryType}</span>
                          {item.description && <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">×{item.pricing.quantity}</span>
                        <span className="font-semibold">{fmt(item.pricing.grandTotal)}</span>
                        {expanded.has(i) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expanded.has(i) && (
                      <div className="px-4 pb-3 pt-1 border-t bg-muted/20 text-xs space-y-3">
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Dimensions</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {Object.entries(item.dimensions).map(([k, v]) => (<span key={k}><span className="text-muted-foreground">{k}:</span> {v}"</span>))}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Pricing</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            <span><span className="text-muted-foreground">per part:</span> {fmt(item.pricing.effectivePricePart)}</span>
                            <span><span className="text-muted-foreground">ext price:</span> {fmt(item.pricing.extPrice)}</span>
                            {item.pricing.techFee > 0 && <span><span className="text-muted-foreground">tech fee:</span> {fmt(item.pricing.techFee)}</span>}
                            {item.pricing.envFee > 0 && <span><span className="text-muted-foreground">env fee:</span> {fmt(item.pricing.envFee)}</span>}
                            <span className="font-semibold"><span className="text-muted-foreground">total:</span> {fmt(item.pricing.grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {pdfExpanded && pdfBlobUrl && (
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <iframe src={pdfBlobUrl} className="w-full" style={{ height: '520px' }} title="Quote PDF Preview" />
                </div>
              )}
              <p className="text-xs text-muted-foreground text-right pt-2">Generated {fmtDate(detail.created_at)}</p>
            </>
          )
        })()}
      </DialogContent>
    </Dialog>
  )
}

// ── RT Quote detail dialog ─────────────────────────────────────────────────────
function RtQuoteDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RtQuoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState<Status>('calculated')
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfVersion, setPdfVersion] = useState(0)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfExpanded, setPdfExpanded] = useState(false)
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null)

  useEffect(() => { return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) } }, [pdfBlobUrl])

  function load() {
    fetch(`/api/rt/quote/${id}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); setEditName(d.customer_name ?? ''); setEditNotes(d.notes ?? ''); setEditStatus(d.status); setPdfVersion(d.pdf_version ?? 0) })
      .catch(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable
  useEffect(() => { load() }, [id])

  useEffect(() => {
    fetch(`/api/rt/analyze/by-quote/${id}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null).then(d => { if (d?.jobId) setAnalysisJobId(d.jobId) }).catch(() => {})
  }, [id])

  async function handleSave() {
    if (!detail) return
    setSaving(true)
    try {
      await fetch(`/api/rt/quote/${id}`, { method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ customerName: editName, notes: editNotes, status: editStatus }) })
      setEditing(false); load()
    } finally { setSaving(false) }
  }

  async function handlePdf() {
    if (!detail) return
    setPdfLoading(true)
    try { await generateAndDownloadPdf('rt', id, detail.quote_number); load() }
    finally { setPdfLoading(false) }
  }

  async function handlePreview() {
    if (pdfBlobUrl) { setPdfExpanded(prev => !prev); return }
    setPdfLoading(true)
    try { await generateAndPreviewPdf('rt', id, setPdfBlobUrl, setPdfExpanded); load() }
    finally { setPdfLoading(false) }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); setPdfExpanded(false); onClose() } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        {loading && <p className="py-8 text-center text-muted-foreground">Loading…</p>}
        {!loading && !detail && <p className="py-8 text-center text-destructive">Failed to load quote.</p>}
        {detail && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                {detail.quote_number}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_STYLE[detail.source]}`}>{detail.source}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">RT</span>
                {pdfVersion > 0 && <span className="text-xs text-muted-foreground">PDF v{pdfVersion}</span>}
              </DialogTitle>
            </DialogHeader>

            {editing ? (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
                <div className="flex gap-2">
                  <div className="flex-1"><p className="text-xs text-muted-foreground mb-1">Customer Name</p><Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" /></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Status</p>
                    <select className="border rounded-md px-2 py-1.5 text-sm bg-background h-8" value={editStatus} onChange={e => setEditStatus(e.target.value as Status)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div><p className="text-xs text-muted-foreground mb-1">Notes</p><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-8 text-sm" placeholder="Optional notes…" /></div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[detail.status]}`}>{detail.status}</span>
                {detail.notes && <span className="text-xs text-muted-foreground">{detail.notes}</span>}
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs ml-auto" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" />Edit</Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={pdfLoading} onClick={handlePdf}><Download className="h-3 w-3" />{pdfLoading ? 'Generating…' : 'Download PDF'}</Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={pdfLoading} onClick={handlePreview}><Eye className="h-3 w-3" />{pdfExpanded ? 'Hide PDF' : 'View PDF'}</Button>
                {analysisJobId && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-blue-400 text-blue-600 hover:bg-blue-50" onClick={() => window.open(`/rt/inspector/${analysisJobId}`, '_blank')}>
                    <Box className="h-3 w-3" />View 3D Analysis
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Part Number</p><p className="font-bold font-mono">{detail.part_number}</p></div>
              <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-bold text-lg">{fmt(detail.grand_total)}</p></div>
            </div>

            {detail.response_body?.totals && (
              <div className="flex gap-4 text-sm text-muted-foreground px-1">
                <span>Labor: {fmt(detail.response_body.totals.totalLabor)}</span>
                <span>Film: {fmt(detail.response_body.totals.totalFilm)}</span>
              </div>
            )}

            {detail.response_body?.views && detail.response_body.views.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{detail.response_body.views.length} View{detail.response_body.views.length !== 1 ? 's' : ''}</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b">
                      <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Shot</th><th className="text-left px-3 py-2">Qty/Film</th><th className="text-left px-3 py-2">Film</th><th className="text-right px-3 py-2">Total/View</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.response_body.views.map((v, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-muted-foreground">{v.viewNumber}</td>
                          <td className="px-3 py-1.5">{v.shotTypeLabel}</td>
                          <td className="px-3 py-1.5">{v.qtyPartsPerFilm}</td>
                          <td className="px-3 py-1.5">{v.filmSize?.label ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{v.costs ? fmt(v.costs.pricePerView) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detail.notes && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">L3 Field Notes</p>
                <p className="text-sm text-foreground/80 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 whitespace-pre-wrap">{detail.notes}</p>
              </div>
            )}

            {pdfExpanded && pdfBlobUrl && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <iframe src={pdfBlobUrl} className="w-full" style={{ height: '520px' }} title="Quote PDF Preview" />
              </div>
            )}
            <p className="text-xs text-muted-foreground text-right pt-2">Generated {fmtDate(detail.created_at)}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Email Quote detail dialog ─────────────────────────────────────────────────

interface EmailQuoteDetail {
  id: string
  quote_number: string
  sender_email: string
  sender_name: string | null
  customer_id: string | null
  customer_name: string | null
  subject: string
  body_text: string
  status: string
  inspection_types: string[] | null
  classification_confidence: number | null
  classification_source: string | null
  is_internal_sender: boolean
  msg_original_subject: string | null
  msg_original_from: string | null
  detected_part_numbers: string[] | null
  matched_part_number: string | null
  matched_part_account: string | null
  matched_part_services: string[] | null
  ut_quote_id: string | null
  ut_quote_number: string | null
  pipeline_error: string | null
  llm_extraction: Record<string, unknown> | null
  received_at: string
  updated_at: string
}

interface ThreadMessage {
  id: string
  direction: 'inbound' | 'outbound'
  subject: string
  body_text: string
  sender_email: string
  recipient_email: string
  triggered_by_check_code: string | null
  sent_at: string
}

const EMAIL_STATUS_STYLE: Record<string, string> = {
  received:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  checking:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  needs_info: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  quoted:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const NDT_TYPE_STYLE: Record<string, string> = {
  RT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  UT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  ET: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  MT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  PT: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  VT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

function EmailQuoteDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<EmailQuoteDetail | null>(null)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/inbox/quotes/${id}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/inbox/quotes/${id}/thread`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []),
    ])
      .then(([q, t]) => { setDetail(q); setThread(t) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const types = detail?.inspection_types?.filter(Boolean) ?? []

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {loading && <p className="py-8 text-center text-muted-foreground">Loading...</p>}
        {!loading && !detail && <p className="py-8 text-center text-destructive">Failed to load email quote.</p>}
        {detail && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                {detail.quote_number}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">email</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EMAIL_STATUS_STYLE[detail.status] ?? ''}`}>
                  {detail.status.replace('_', ' ')}
                </span>
                {types.map(t => (
                  <span key={t} className={`text-xs font-medium px-2 py-0.5 rounded-full ${NDT_TYPE_STYLE[t] ?? ''}`}>{t}</span>
                ))}
              </DialogTitle>
            </DialogHeader>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Sender</p>
                <p className="font-medium text-sm">{detail.sender_name ? `${detail.sender_name} <${detail.sender_email}>` : detail.sender_email}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium text-sm">{detail.customer_name ?? 'Unknown'}</p>
                {!detail.customer_id && <p className="text-[10px] text-blue-500 mt-0.5">New prospect</p>}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 mt-2">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="font-medium text-sm">{detail.subject}</p>
              {detail.msg_original_subject && detail.msg_original_subject !== detail.subject && (
                <p className="text-xs text-muted-foreground mt-1">Original (.msg): {detail.msg_original_subject}</p>
              )}
            </div>

            {detail.classification_confidence != null && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground px-1 mt-1">
                <span>Classification: {(detail.classification_confidence * 100).toFixed(0)}% confidence</span>
                {detail.classification_source && <span>via {detail.classification_source}</span>}
              </div>
            )}

            {/* Part match */}
            {detail.matched_part_number && (
              <div className="rounded-lg border bg-muted/30 p-3 mt-2">
                <p className="text-xs text-muted-foreground">Matched Part (BOM)</p>
                <p className="font-medium text-sm font-mono">{detail.matched_part_number}</p>
                {detail.matched_part_account && (
                  <p className="text-xs text-muted-foreground mt-0.5">Account: {detail.matched_part_account}</p>
                )}
                {detail.matched_part_services && detail.matched_part_services.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Services: {detail.matched_part_services.join(', ')}</p>
                )}
              </div>
            )}

            {/* UT Quote result */}
            {detail.ut_quote_number && (
              <div className="rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 mt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Generated UT Quote</p>
                    <p className="font-bold text-lg font-mono">{detail.ut_quote_number}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => {
                      onClose()
                      window.location.href = `/quotes`
                    }}
                  >
                    View Quote
                  </Button>
                </div>
              </div>
            )}

            {/* LLM extraction */}
            {detail.llm_extraction && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  AI Dimension Extraction
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {detail.llm_extraction.geometryType && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Geometry</p>
                      <p className="text-xs font-medium">{String(detail.llm_extraction.geometryType).replace('_', ' ')}</p>
                    </div>
                  )}
                  {detail.llm_extraction.thickness != null && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Thickness</p>
                      <p className="text-xs font-mono">{String(detail.llm_extraction.thickness)}"</p>
                    </div>
                  )}
                  {detail.llm_extraction.width != null && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Width</p>
                      <p className="text-xs font-mono">{String(detail.llm_extraction.width)}"</p>
                    </div>
                  )}
                  {detail.llm_extraction.length != null && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Length</p>
                      <p className="text-xs font-mono">{String(detail.llm_extraction.length)}"</p>
                    </div>
                  )}
                  {detail.llm_extraction.diameter != null && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Diameter</p>
                      <p className="text-xs font-mono">{String(detail.llm_extraction.diameter)}"</p>
                    </div>
                  )}
                  {detail.llm_extraction.quantity != null && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Quantity</p>
                      <p className="text-xs font-mono">{String(detail.llm_extraction.quantity)}</p>
                    </div>
                  )}
                  {detail.llm_extraction.confidence && (
                    <div className="rounded border bg-muted/20 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Confidence</p>
                      <p className="text-xs font-medium">{String(detail.llm_extraction.confidence)}</p>
                    </div>
                  )}
                </div>
                {detail.llm_extraction.notes && (
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">{String(detail.llm_extraction.notes)}</p>
                )}
              </div>
            )}

            {/* Pipeline error */}
            {detail.pipeline_error && (
              <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 mt-2">
                <p className="text-xs text-muted-foreground">Pipeline Error</p>
                <p className="text-sm text-red-700 dark:text-red-300">{detail.pipeline_error}</p>
              </div>
            )}

            {/* Thread */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Thread ({thread.length} message{thread.length !== 1 ? 's' : ''})
              </p>
              <div className="space-y-2">
                {thread.map(msg => (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-3 text-sm ${
                      msg.direction === 'outbound'
                        ? 'ml-8 bg-primary/5 border-primary/20'
                        : 'mr-8 bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-medium">
                        {msg.direction === 'outbound' ? `To: ${msg.recipient_email}` : `From: ${msg.sender_email}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {fmtDate(msg.sent_at)}
                      </span>
                    </div>
                    {msg.subject && <p className="text-xs text-muted-foreground mb-1 font-medium">{msg.subject}</p>}
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{msg.body_text}</p>
                    {msg.triggered_by_check_code && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">
                          Auto-reply triggered by: <code className="bg-muted px-1 rounded">{msg.triggered_by_check_code}</code>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {thread.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No messages in thread yet.</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-right pt-2">Received {fmtDate(detail.received_at)}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Audit log dialog ───────────────────────────────────────────────────────────
function AuditLogDialog({ intakeId, onClose }: { intakeId: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 overflow-hidden flex flex-col">
        <ExecutionLogViewer intakeId={intakeId} onClose={onClose} embedded />
      </DialogContent>
    </Dialog>
  )
}

// ── Exports ────────────────────────────────────────────────────────────────────
export { UtQuoteDetailDialog, RtQuoteDetailDialog, EmailQuoteDetailDialog, AuditLogDialog }
