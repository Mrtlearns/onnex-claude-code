import { useCaseSettlement } from '../hooks/useCaseSettlement';
import { useSettlementOffers } from '../hooks/useSettlementOffers';
import { useCaseCosts } from '../hooks/useCaseCosts';
import type { Case, Client } from '../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const COST_TYPE_LABEL: Record<string, string> = {
  medical_lien: 'Medical Lien',
  filing_fee: 'Filing Fee',
  expert_fee: 'Expert Fee',
  investigation: 'Investigation',
  other: 'Other',
};

interface Props {
  caseId: string;
  caseData?: Case | null;
  clientData?: Client | null;
}

export function SettlementSummaryPanel({ caseId, caseData, clientData }: Props) {
  const { data: settlement } = useCaseSettlement(caseId);
  const { data: offers = [] } = useSettlementOffers(caseId);
  const { data: costs = [] } = useCaseCosts(caseId);

  if (!settlement) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-lg">
        Settlement summary available after disbursement is saved
      </div>
    );
  }

  const clientName = clientData
    ? `${clientData.first_name} ${clientData.last_name}`
    : 'N/A';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Settlement Summary</h3>
        <button
          onClick={() => window.print()}
          className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted"
        >
          🖨 Print
        </button>
      </div>

      <div id="settlement-summary-printable" className="space-y-5 text-sm">
        {/* Case Header */}
        <div className="border rounded-lg p-4 space-y-1">
          <h4 className="font-bold text-base">
            Case {caseData?.case_number ?? 'N/A'} — {clientName}
          </h4>
          <p className="text-muted-foreground">
            Type: {caseData?.case_type ?? 'N/A'} &nbsp;•&nbsp; Settled: {settlement.settled_at}
          </p>
          {caseData?.date_of_loss && (
            <p className="text-muted-foreground">Date of Loss: {caseData.date_of_loss}</p>
          )}
        </div>

        {/* Negotiation History */}
        {offers.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              Negotiation History
            </h4>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Party</th>
                  <th className="text-right p-2 font-medium">Amount</th>
                  <th className="text-left p-2 font-medium">Notes</th>
                  <th className="text-center p-2 font-medium">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id} className={`border-t ${o.accepted ? 'bg-green-50 font-semibold' : ''}`}>
                    <td className="p-2">{o.offered_at}</td>
                    <td className="p-2 capitalize">{o.offer_by}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(o.amount)}</td>
                    <td className="p-2 max-w-[150px] truncate">{o.notes ?? '—'}</td>
                    <td className="p-2 text-center">{o.accepted ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cost Breakdown */}
        {costs.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              Costs &amp; Liens
            </h4>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-right p-2 font-medium">Amount</th>
                  <th className="text-center p-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{COST_TYPE_LABEL[c.cost_type] ?? c.cost_type}</td>
                    <td className="p-2 max-w-[200px] truncate">{c.description}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(c.amount)}</td>
                    <td className="p-2 text-center">{c.paid ? '✓' : '—'}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td colSpan={2} className="p-2">Total Costs</td>
                  <td className="p-2 text-right tabular-nums">{fmt(settlement.costs_total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Disbursement Breakdown */}
        <div className="space-y-2">
          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
            Disbursement
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <div className="flex justify-between p-3 border-b">
              <span>Gross Settlement</span>
              <span className="font-semibold tabular-nums">{fmt(settlement.gross_settlement)}</span>
            </div>
            <div className="flex justify-between p-3 border-b text-red-700">
              <span>Attorney Fee ({settlement.attorney_fee_pct}%)</span>
              <span className="tabular-nums">− {fmt(settlement.attorney_fee_amount)}</span>
            </div>
            <div className="flex justify-between p-3 border-b text-amber-700">
              <span>Costs &amp; Liens</span>
              <span className="tabular-nums">− {fmt(settlement.costs_total)}</span>
            </div>
            <div className="flex justify-between p-3 bg-green-50 font-bold text-green-800 text-base">
              <span>Net to Client</span>
              <span className="tabular-nums">{fmt(settlement.net_to_client)}</span>
            </div>
          </div>
        </div>

        {settlement.notes && (
          <p className="text-xs text-muted-foreground italic border-t pt-3">{settlement.notes}</p>
        )}
      </div>
    </div>
  );
}
