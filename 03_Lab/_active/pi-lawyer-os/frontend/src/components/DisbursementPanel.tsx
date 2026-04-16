import { useState, useEffect } from 'react';
import { useCaseSettlement, useCreateCaseSettlement, useUpdateCaseSettlement } from '../hooks/useCaseSettlement';
import type { Case } from '../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

interface Props {
  caseId: string;
  caseData?: Case | null;
}

export function DisbursementPanel({ caseId, caseData }: Props) {
  const { data: settlement, isLoading } = useCaseSettlement(caseId);
  const create = useCreateCaseSettlement();
  const update = useUpdateCaseSettlement();

  const [editing, setEditing] = useState(false);
  const [gross, setGross] = useState('');
  const [feePct, setFeePct] = useState('33.33');
  const [costsTotal, setCostsTotal] = useState('');
  const [settledAt, setSettledAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Pre-populate form when entering edit mode
  useEffect(() => {
    if (editing) {
      if (settlement) {
        setGross(String(settlement.gross_settlement));
        setFeePct(String(settlement.attorney_fee_pct));
        setCostsTotal(String(settlement.costs_total));
        setSettledAt(settlement.settled_at);
        setNotes(settlement.notes ?? '');
      } else {
        const defaultPct = caseData?.attorney_fee_pct ?? 33.33;
        setFeePct(String(defaultPct));
        setGross('');
        setCostsTotal('0');
      }
    }
  }, [editing, settlement, caseData]);

  // Live preview calculation
  const grossNum = parseFloat(gross) || 0;
  const pctNum = parseFloat(feePct) || 0;
  const costsNum = parseFloat(costsTotal) || 0;
  const feeAmount = Math.round(grossNum * pctNum / 100 * 100) / 100;
  const netToClient = Math.round((grossNum - feeAmount - costsNum) * 100) / 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grossNum) return;
    const payload = {
      case_id: caseId,
      gross_settlement: grossNum,
      attorney_fee_pct: pctNum,
      costs_total: costsNum,
      settled_at: settledAt,
      notes: notes || undefined,
    };
    if (settlement) {
      await update.mutateAsync({ id: settlement.id, case_id: caseId, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    setEditing(false);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Disbursement Calculator</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {settlement ? 'Edit' : 'Enter Settlement'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Gross Settlement</label>
              <input
                type="number"
                step="0.01"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                placeholder="0.00"
                required
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Attorney Fee %</label>
              <input
                type="number"
                step="0.01"
                max="100"
                value={feePct}
                onChange={(e) => setFeePct(e.target.value)}
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Total Costs</label>
              <input
                type="number"
                step="0.01"
                value={costsTotal}
                onChange={(e) => setCostsTotal(e.target.value)}
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Settlement Date</label>
              <input
                type="date"
                value={settledAt}
                onChange={(e) => setSettledAt(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>
          </div>

          {/* Live preview */}
          {grossNum > 0 && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Settlement</span>
                <span className="font-medium tabular-nums">{fmt(grossNum)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Attorney Fee ({pctNum}%)</span>
                <span className="tabular-nums">− {fmt(feeAmount)}</span>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>Costs &amp; Liens</span>
                <span className="tabular-nums">− {fmt(costsNum)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1.5 text-green-700">
                <span>Net to Client</span>
                <span className="tabular-nums">{fmt(netToClient)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border rounded-md px-3 py-1.5 text-sm bg-background resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {create.isPending || update.isPending ? 'Saving…' : 'Save Settlement'}
            </button>
          </div>
        </form>
      ) : settlement ? (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">Gross Settlement</span>
            <span className="font-medium tabular-nums">{fmt(settlement.gross_settlement)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-red-600">
            <span>Attorney Fee ({settlement.attorney_fee_pct}%)</span>
            <span className="tabular-nums">− {fmt(settlement.attorney_fee_amount)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-amber-600">
            <span>Costs &amp; Liens</span>
            <span className="tabular-nums">− {fmt(settlement.costs_total)}</span>
          </div>
          <div className="flex justify-between py-2 font-bold border-t text-green-700 text-base">
            <span>Net to Client</span>
            <span className="tabular-nums">{fmt(settlement.net_to_client)}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">Settled {settlement.settled_at}</p>
          {settlement.notes && (
            <p className="text-xs text-muted-foreground italic">{settlement.notes}</p>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-lg">
          No settlement entered yet
        </div>
      )}
    </div>
  );
}
