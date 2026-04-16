import fs from 'node:fs/promises';
import path from 'node:path';

const GOTENBERG_URL = process.env.GOTENBERG_URL ?? 'http://gotenberg:3000';
const PDF_STORE = process.env.PDF_STORE ?? '/pdf-store';

// NDTesting logo embedded as base64 data URI — avoids file path issues in Gotenberg container
const LOGO_B64 = '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';
const LOGO_DATA_URI = `data:image/png;base64,${LOGO_B64}`;

// Legacy CSS used by RT quotes and any callers of buildHtmlDocument
const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 0.75in; }
  h1 { font-size: 16pt; margin-bottom: 4px; }
  h2 { font-size: 12pt; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; color: #333; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 16px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10.5pt; }
  .row .label { color: #555; }
  .row.total { border-top: 1pt solid #999; margin-top: 4px; padding-top: 6px; font-weight: bold; font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; border-bottom: 1.5pt solid #333; padding: 4px 6px; font-size: 9pt; color: #333; }
  td { padding: 4px 6px; border-bottom: 0.5pt solid #ddd; }
  tr.subtotal td { font-weight: bold; border-top: 1pt solid #999; border-bottom: none; }
  .tier-active { font-weight: bold; }
  .footer { margin-top: 24px; font-size: 8.5pt; color: #888; border-top: 0.5pt solid #ccc; padding-top: 8px; }
  @page { margin: 0.75in; }
`;

export function buildHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`;
}

// ── UT Quote PDF Template ─────────────────────────────────────────────────────

const UT_PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a2e; background: #fff; }
  @page { margin: 0.65in 0.75in; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid #1c3557; margin-bottom: 16px; }
  .header-logo img { height: 52px; width: auto; }
  .header-right { text-align: right; }
  .doc-title { font-size: 16pt; font-weight: bold; color: #1c3557; letter-spacing: 0.5px; }
  .doc-meta { font-size: 8.5pt; color: #555; margin-top: 4px; line-height: 1.6; }

  /* ── Two-column grid ── */
  .two-col { display: flex; gap: 20px; margin-bottom: 14px; }
  .two-col .col { flex: 1; }
  .section-title { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; color: #1c3557; border-bottom: 1.5pt solid #1c3557; padding-bottom: 3px; margin-bottom: 6px; }
  .kv { display: flex; justify-content: space-between; padding: 2px 0; font-size: 9.5pt; border-bottom: 0.5pt solid #eee; }
  .kv .k { color: #666; }
  .kv .v { font-weight: 500; text-align: right; max-width: 60%; }

  /* ── Full-width section ── */
  .section { margin-bottom: 14px; }

  /* ── Dimensions chips ── */
  .dims { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 9pt; padding: 6px 0; }
  .dims span { color: #444; }
  .dims span .lbl { color: #888; font-size: 8.5pt; }

  /* ── Pricing table ── */
  .price-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .price-table td { padding: 4px 6px; }
  .price-table td:last-child { text-align: right; font-weight: 500; }
  .price-table .sep td { border-top: 0.5pt solid #ccc; padding-top: 6px; }
  .price-table .rush td { color: #b45309; }
  .price-table .grand td { border-top: 2pt solid #1c3557; font-size: 13pt; font-weight: bold; color: #1c3557; padding-top: 8px; }
  .price-table .muted td:first-child { color: #888; }

  /* ── Terms & signature ── */
  .terms { font-size: 8pt; color: #555; margin-bottom: 14px; line-height: 1.5; }
  .sig-block { display: flex; gap: 32px; margin-top: 12px; }
  .sig-line { flex: 1; border-top: 1pt solid #555; padding-top: 4px; font-size: 8pt; color: #555; }

  /* ── Footer ── */
  .footer { margin-top: 20px; padding-top: 8px; border-top: 0.5pt solid #ccc; display: flex; justify-content: space-between; font-size: 7.5pt; color: #999; }

  /* ── Badges ── */
  .badge { display: inline-block; font-size: 7.5pt; font-weight: bold; padding: 1px 7px; border-radius: 10px; }
  .badge-rush { background: #fef3c7; color: #92400e; border: 1pt solid #f59e0b; }
  .badge-normal { background: #f0f9ff; color: #0369a1; border: 1pt solid #7dd3fc; }
`;

export interface UtQuotePdfData {
  quoteNumber: string;
  generatedAt: string;
  customerName: string;
  customerNotes?: string;
  standard?: string;
  rushLevel: 'normal' | 'expedited';
  requestedBy?: string;
  items: Array<{
    geometryType: string;
    description?: string;
    partNumber?: string;
    dimensions: Record<string, number | undefined>;
    scanParameters: {
      scanIndex: number;
      loadTime: number;
      hourlyRate: number;
      indexes: number;
      secPerScanline: number;
      scanTimeMin: number;
      totalTimeMin: number;
    };
    pricing: {
      timePricePart: number;
      weightPricePart: number | null;
      effectivePricePart: number;
      quantity: number;
      extPrice: number;
      lotCharge: number;
      techFee: number;
      subTotal: number;
      envFee: number;
      grandTotal: number;
    };
  }>;
  summary: {
    totalGrand: number;
    totalParts: number;
    totalTechFees: number;
    totalEnvFees: number;
    rushSurcharge: number;
    rushMultiplier: number;
    deliveryFee: string;
    leadTime: string;
  };
  pdfVersion: number;
}

export function buildUtQuoteHtml(data: UtQuotePdfData): string {
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const isRush = data.rushLevel === 'expedited';

  const dimLabels: Record<string, string> = {
    thickness: 'Thickness', width: 'Width', length: 'Length',
    diameter: 'Diameter', outerDiameter: 'OD', innerDiameter: 'ID', numScans: 'Scans',
  };

  const itemsHtml = data.items.map((item, idx) => {
    const dimEntries = Object.entries(item.dimensions)
      .filter(([, v]) => v !== undefined && v !== null && (v as number) > 0)
      .map(([k, v]) => `<span><span class="lbl">${dimLabels[k] ?? k}:</span> ${v}"</span>`)
      .join('');

    return `
      <div class="section" style="page-break-inside: avoid;">
        <div class="section-title">Line Item ${idx + 1}${item.partNumber ? ' — ' + item.partNumber : ''}${item.description ? ' — ' + item.description : ''}</div>

        <div class="two-col">
          <div class="col">
            <div class="kv"><span class="k">Geometry</span><span class="v">${item.geometryType.replace(/_/g, ' ')}</span></div>
            <div class="kv"><span class="k">Quantity</span><span class="v">${item.pricing.quantity} pcs</span></div>
            <div class="kv"><span class="k">Scan Index</span><span class="v">${item.scanParameters.scanIndex}"</span></div>
            <div class="kv"><span class="k">Hourly Rate</span><span class="v">$${item.scanParameters.hourlyRate}/hr</span></div>
          </div>
          <div class="col">
            <div class="section-title" style="margin-top:0">Scan Metrics</div>
            <div class="kv"><span class="k">Scan indexes</span><span class="v">${item.scanParameters.indexes}</span></div>
            <div class="kv"><span class="k">Sec / scanline</span><span class="v">${item.scanParameters.secPerScanline.toFixed(3)}</span></div>
            <div class="kv"><span class="k">Scan time</span><span class="v">${item.scanParameters.scanTimeMin.toFixed(3)} min</span></div>
            <div class="kv"><span class="k">Load time</span><span class="v">${item.scanParameters.loadTime} min</span></div>
            <div class="kv"><span class="k">Total time</span><span class="v">${item.scanParameters.totalTimeMin.toFixed(3)} min</span></div>
          </div>
        </div>

        ${dimEntries ? `<div class="dims" style="margin-bottom:8px">${dimEntries}</div>` : ''}

        <div class="section-title">Pricing — ${item.pricing.quantity} pc @ ${data.customerName}</div>
        <table class="price-table">
          <tr class="muted"><td>Time price / part</td><td>${fmt(item.pricing.timePricePart)}</td></tr>
          ${item.pricing.weightPricePart !== null ? `<tr class="muted"><td>Weight price / part</td><td>${fmt(item.pricing.weightPricePart)}</td></tr>` : ''}
          <tr class="muted"><td>Effective price / part</td><td>${fmt(item.pricing.effectivePricePart)}</td></tr>
          <tr class="muted"><td>Extended (×${item.pricing.quantity})</td><td>${fmt(item.pricing.extPrice)}</td></tr>
          <tr class="muted"><td>Lot charge</td><td>${fmt(item.pricing.lotCharge)}</td></tr>
          ${item.pricing.techFee > 0 ? `<tr class="muted"><td>Technique fee</td><td>${fmt(item.pricing.techFee)}</td></tr>` : ''}
          <tr class="sep muted"><td>Sub-total</td><td>${fmt(item.pricing.subTotal)}</td></tr>
          ${item.pricing.envFee > 0 ? `<tr class="muted"><td>Environmental fee (2%)</td><td>${fmt(item.pricing.envFee)}</td></tr>` : ''}
          <tr class="sep"><td style="font-weight:600">Line Total</td><td>${fmt(item.pricing.grandTotal)}</td></tr>
        </table>
      </div>
    `;
  }).join('');

  const baseGrand = data.summary.totalGrand - data.summary.rushSurcharge;

  const body = `
    <!-- HEADER -->
    <div class="header">
      <div class="header-logo">
        <img src="${LOGO_DATA_URI}" alt="NDT Testing" />
      </div>
      <div class="header-right">
        <div class="doc-title">ULTRASONIC TEST QUOTE</div>
        <div class="doc-meta">
          Quote #: <strong>${data.quoteNumber}</strong><br>
          Date: ${date}<br>
          ${data.requestedBy ? `Prepared by: ${data.requestedBy}<br>` : ''}
          PDF Version: ${data.pdfVersion}
        </div>
      </div>
    </div>

    <!-- BILL TO + JOB DETAILS -->
    <div class="two-col">
      <div class="col">
        <div class="section-title">Bill To</div>
        <div style="font-size:10.5pt; font-weight:bold; margin-bottom:4px">${data.customerName}</div>
        ${data.customerNotes ? `<div style="font-size:8.5pt; color:#555; font-style:italic">${data.customerNotes}</div>` : ''}
      </div>
      <div class="col">
        <div class="section-title">Job Details</div>
        <div class="kv"><span class="k">Standard / Spec</span><span class="v">${data.standard || '—'}</span></div>
        <div class="kv"><span class="k">Rush Level</span>
          <span class="v">
            <span class="badge ${isRush ? 'badge-rush' : 'badge-normal'}">
              ${isRush ? 'EXPEDITED (+25%)' : 'NORMAL'}
            </span>
          </span>
        </div>
        <div class="kv"><span class="k">Lead Time</span><span class="v">${data.summary.leadTime}</span></div>
        <div class="kv"><span class="k">Delivery</span><span class="v">${data.summary.deliveryFee !== 'No' ? data.summary.deliveryFee : 'No charge'}</span></div>
      </div>
    </div>

    <!-- LINE ITEMS -->
    ${itemsHtml}

    <!-- QUOTE TOTAL -->
    <div class="section" style="page-break-inside: avoid;">
      <div class="section-title">Quote Total</div>
      <table class="price-table">
        ${data.items.length > 1 ? `<tr class="muted"><td>Sum of line totals</td><td>${fmt(baseGrand)}</td></tr>` : ''}
        ${data.summary.totalTechFees > 0 ? `<tr class="muted"><td>Total technique fees</td><td>${fmt(data.summary.totalTechFees)}</td></tr>` : ''}
        ${data.summary.totalEnvFees > 0 ? `<tr class="muted"><td>Total environmental fees</td><td>${fmt(data.summary.totalEnvFees)}</td></tr>` : ''}
        ${isRush ? `<tr class="rush"><td>Rush surcharge (25%)</td><td>+ ${fmt(data.summary.rushSurcharge)}</td></tr>` : ''}
        <tr class="grand"><td>GRAND TOTAL</td><td>${fmt(data.summary.totalGrand)}</td></tr>
      </table>
    </div>

    <!-- TERMS -->
    <div class="section terms" style="page-break-inside: avoid;">
      <strong>Terms & Conditions:</strong> This quotation is valid for 30 days from the date of issue.
      Prices are based on the specifications and quantities stated herein. Any changes to scope,
      materials, or quantities may result in revised pricing. Payment terms: Net 30 days.
      This quote does not constitute an acceptance of a purchase order.
    </div>

    <!-- SIGNATURE -->
    <div style="page-break-inside: avoid;">
      <div class="section-title">Authorization — Level III Approval</div>
      <div class="sig-block">
        <div class="sig-line">
          <div style="height:28px"></div>
          Authorized by (Level III)
        </div>
        <div class="sig-line">
          <div style="height:28px"></div>
          Date
        </div>
        <div class="sig-line">
          <div style="height:28px"></div>
          Customer Acceptance (optional)
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <span>NDT Testing Services · Confidential</span>
      <span>${data.quoteNumber} · Generated ${date}</span>
      <span>Page 1 of 1</span>
    </div>
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>UT Quote — ${data.quoteNumber}</title><style>${UT_PDF_CSS}</style></head><body>${body}</body></html>`;
}

export async function generatePdf(htmlContent: string): Promise<Buffer> {
  const form = new FormData();
  form.append('files', new Blob([htmlContent], { type: 'text/html' }), 'index.html');

  const response = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gotenberg error ${response.status}: ${text}`);
  }

  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function storePdf(
  quoteType: 'ut' | 'rt',
  quoteId: string,
  version: number,
  pdfBuffer: Buffer,
): Promise<string> {
  const dir = path.join(PDF_STORE, quoteType, quoteId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `v${version}.pdf`);
  await fs.writeFile(filePath, pdfBuffer);
  return filePath;
}

export function fmtMoney(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
