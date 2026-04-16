// Opens a new window with a printable quote and auto-triggers print dialog

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 0.75in; }
  h1 { font-size: 16pt; margin-bottom: 4px; }
  h2 { font-size: 12pt; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; color: #333; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 16px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10.5pt; }
  .row .label { color: #555; }
  .row.total { border-top: 1pt solid #999; margin-top: 4px; padding-top: 6px; font-weight: bold; font-size: 12pt; }
  .dims { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 10pt; margin-bottom: 8px; }
  .dims span .lbl { color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; border-bottom: 1.5pt solid #333; padding: 4px 6px; font-size: 9pt; color: #333; }
  td { padding: 4px 6px; border-bottom: 0.5pt solid #ddd; }
  tr.subtotal td { font-weight: bold; border-top: 1pt solid #999; border-bottom: none; }
  .tier-active { font-weight: bold; }
  .footer { margin-top: 24px; font-size: 8.5pt; color: #888; border-top: 0.5pt solid #ccc; padding-top: 8px; }
  @page { margin: 0.75in; }
`

function newWin(title: string, body: string) {
  const w = window.open('', '_blank', 'width=850,height=1100')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

export interface UtPrintData {
  customerName: string
  geometry: string
  dims: Record<string, number>
  scanIndex: number
  quantity: number
  loadTime: number
  hourlyRate: number
  scanIndexes: number
  secPerScanline: number
  scanTimeMin: number
  totalTimeMin: number
  timePricePart: number
  weightPricePart?: number | null
  useWeight: boolean
  pricePart: number
  extPrice: number
  lotCharge: number
  techFee: number
  subTotal: number
  envFee: number
  grandTotal: number
  leadTime: string
  deliveryFee: string
  standard?: string
  rushLevel?: 'normal' | 'expedited'
  rushSurcharge?: number
}

export function printUtQuote(data: UtPrintData) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const dimRows = Object.entries(data.dims)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<span><span class="lbl">${k}:</span> ${v}"</span>`)
    .join('')

  const weightRow = data.useWeight && data.weightPricePart != null
    ? `<div class="row"><span class="label">Weight price/part</span><span>${fmt(data.weightPricePart)}</span></div>`
    : ''

  const techRow = data.techFee > 0
    ? `<div class="row"><span class="label">Technique fee</span><span>${fmt(data.techFee)}</span></div>` : ''
  const envRow = data.envFee > 0
    ? `<div class="row"><span class="label">Environmental fee</span><span>${fmt(data.envFee)}</span></div>` : ''
  const rushRow = data.rushLevel === 'expedited' && data.rushSurcharge
    ? `<div class="row" style="color:#92400e"><span class="label">Rush surcharge (25%)</span><span>${fmt(data.rushSurcharge)}</span></div>` : ''

  const body = `
    <h1>NDT Portal — UT Quote</h1>
    <div class="meta">Generated: ${date}</div>

    <h2>Job Details</h2>
    <div class="row"><span class="label">Customer</span><span>${data.customerName}</span></div>
    <div class="row"><span class="label">Geometry</span><span>${data.geometry}</span></div>
    <div class="row"><span class="label">Quantity</span><span>${data.quantity} pc</span></div>
    <div class="row"><span class="label">Scan Index</span><span>${data.scanIndex}"</span></div>
    ${data.standard ? `<div class="row"><span class="label">Standard / Spec</span><span>${data.standard}</span></div>` : ''}
    <div class="row"><span class="label">Rush Level</span><span>${data.rushLevel === 'expedited' ? 'EXPEDITED (+25%)' : 'Normal'}</span></div>

    <h2>Dimensions</h2>
    <div class="dims">${dimRows}</div>

    <h2>Scan Metrics</h2>
    <div class="row"><span class="label">Scan indexes</span><span>${data.scanIndexes.toFixed(2)}</span></div>
    <div class="row"><span class="label">Sec / scanline</span><span>${data.secPerScanline.toFixed(3)}</span></div>
    <div class="row"><span class="label">Scan time</span><span>${data.scanTimeMin.toFixed(3)} min</span></div>
    <div class="row"><span class="label">Load time</span><span>${data.loadTime} min</span></div>
    <div class="row"><span class="label">Total time</span><span>${data.totalTimeMin.toFixed(3)} min</span></div>
    <div class="row"><span class="label">Hourly rate</span><span>$${data.hourlyRate}/hr</span></div>
    <div class="row"><span class="label">Time price / part</span><span>${fmt(data.timePricePart)}</span></div>
    ${weightRow}

    <h2>Lot Pricing — ${data.quantity} pc @ ${data.customerName}</h2>
    <div class="row"><span class="label">Price / part</span><span>${fmt(data.pricePart)}</span></div>
    <div class="row"><span class="label">Extended price</span><span>${fmt(data.extPrice)}</span></div>
    <div class="row"><span class="label">Lot charge</span><span>${fmt(data.lotCharge)}</span></div>
    ${techRow}
    <div class="row"><span class="label">Sub-total</span><span>${fmt(data.subTotal)}</span></div>
    ${envRow}
    ${rushRow}
    <div class="row total"><span>Grand Total</span><span>${fmt(data.grandTotal)}</span></div>

    <div class="row" style="margin-top:12px"><span class="label">Lead time</span><span>${data.leadTime}</span></div>
    <div class="row"><span class="label">Delivery fee</span><span>${data.deliveryFee}</span></div>

    <div class="footer">NDT Portal · Onnex AI · Printed ${date}</div>
  `
  newWin(`UT Quote — ${data.customerName}`, body)
}

export interface RtPrintData {
  partNumber: string
  customerName: string
  tierLabel: string
  views: Array<{
    viewNumber: number
    shotLabel: string
    qtyPerFilm: number
    filmLabel: string
    unpackLoad: number
    darkroomSort: number
    shotTime: number
    readTime: number
    laborCost: number
    filmCost: number
    pricePerView: number
  }>
  totalLabor: number
  totalFilm: number
  totalPrice: number
  tiers: Array<{ label: string; filmTotal: number; grandTotal: number; isActive: boolean }>
}

export function printRtQuote(data: RtPrintData) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const viewRows = data.views.map(v => `
    <tr>
      <td>${v.viewNumber}</td>
      <td>${v.shotLabel}</td>
      <td>${v.qtyPerFilm}</td>
      <td>${v.filmLabel}</td>
      <td>${v.unpackLoad}</td>
      <td>${v.darkroomSort}</td>
      <td>${v.shotTime}</td>
      <td>${v.readTime}</td>
      <td style="text-align:right">${fmt(v.laborCost)}</td>
      <td style="text-align:right">${fmt(v.filmCost)}</td>
      <td style="text-align:right;font-weight:600">${fmt(v.pricePerView)}</td>
    </tr>
  `).join('')

  const tierRows = data.tiers.map(t => `
    <tr class="${t.isActive ? 'tier-active' : ''}">
      <td>${t.label}${t.isActive ? ' ✓' : ''}</td>
      <td style="text-align:right">${fmt(t.filmTotal)}</td>
      <td style="text-align:right">${fmt(t.grandTotal)}</td>
    </tr>
  `).join('')

  const body = `
    <h1>NDT Portal — RT Quote</h1>
    <div class="meta">Generated: ${date}</div>

    <h2>Job Details</h2>
    <div class="row"><span class="label">Part Number</span><span>${data.partNumber}</span></div>
    <div class="row"><span class="label">Customer</span><span>${data.customerName}</span></div>
    <div class="row"><span class="label">Pricing Tier</span><span>${data.tierLabel}</span></div>

    <h2>View Rows</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Shot</th><th>Qty/Film</th><th>Film</th>
          <th>Load</th><th>DRK Sort</th><th>Shot</th><th>Read</th>
          <th style="text-align:right">Labor</th>
          <th style="text-align:right">Film</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${viewRows}</tbody>
      <tfoot>
        <tr class="subtotal">
          <td colspan="8" style="text-align:right">Totals</td>
          <td style="text-align:right">${fmt(data.totalLabor)}</td>
          <td style="text-align:right">${fmt(data.totalFilm)}</td>
          <td style="text-align:right">${fmt(data.totalPrice)}</td>
        </tr>
      </tfoot>
    </table>

    <h2>Pricing Tier Comparison</h2>
    <table>
      <thead><tr><th>Tier</th><th style="text-align:right">Film Total</th><th style="text-align:right">Grand Total</th></tr></thead>
      <tbody>${tierRows}</tbody>
    </table>

    <div class="footer">NDT Portal · Onnex AI · Printed ${date}</div>
  `
  newWin(`RT Quote — ${data.partNumber}`, body)
}
