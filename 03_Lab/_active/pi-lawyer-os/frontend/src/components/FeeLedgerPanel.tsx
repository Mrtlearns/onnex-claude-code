import { useState } from 'react';
import { useCaseCosts, useCreateCaseCost, useUpdateCaseCost, useDeleteCaseCost } from '../hooks/useCaseCosts';
import { useUpdateCaseSettlement, useCaseSettlement } from '../hooks/useCaseSettlement';
import type { CostType } from '../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const COST_TYPE_LABEL: Record<CostType, string> = {
  medical_lien: 'Medical Lien',
  filing_fee: 'Filing Fee',
  expert_fee: 'Expert Fee',
  investigation: 'Investigation',
  other: 'Other',
};

const COST_TYPE_COLOR: Record<CostType, string> = {
  medical_lien: 'bg-purple-100 text-purple-700',
  filing_fee: 'bg-yellow-100 text-yellow-700',
  expert_fee: 'bg-blue-100 text-blue-700',
  investigation: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

interface AddCostFormProps {
  caseId: string;
  onClose: () => void;
}

function AddCostForm({ caseId, onClose }: AddCostFormProps) {
  const create = useCreateCaseCost();
  const [costType, setCostType] = useState<CostType>('medical_lien');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!parsed || isNaN(parsed) || !description.trim()) return;
    await create.mutateAsync({ case_id: caseId, cost_type: costType, description: description.trim(), amount: parsed });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-muted/40 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={costType}
            onChange={(e) => setCostType(e.target.value as CostType)}
            className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            {(Object.keys(COST_TYPE_LABEL) as CostType[]).map((t) => (
              <option key={t} value={t}>{COST_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Amount</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$0.00"
            required
            className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="e.g. Dr. Smith Chiro — lien balance"
          className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? 'Saving…' : 'Add Cost'}
        </button>
      </div>
    </form>
  );
}

interface Props {
  caseId: string;
}

export function FeeLedgerPanel({ caseId }: Props) {
  const { data: costs = [], isLoading } = useCaseCosts(caseId);
  const { data: settlement } = useCaseSettlement(caseId);
  const updateCost = useUpdateCaseCost();
  const deleteCost = useDeleteCaseCost();
  const updateSettlement = useUpdateCaseSettlement();
  const [showForm, setShowForm] = useState(false);

  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
  const totalLiens = costs.filter((c) => c.cost_type === 'medical_lien').reduce((sum, c) => sum + c.amount, 0);
  const totalUnpaid = costs.filter((c) => !c.paid).reduce((sum, c) => sum + c.amount, 0);

  const syncToCalculator = () => {
    if (!settlement) return;
    updateSettlement.mutate({
      id: settlement.id,
      case_id: caseId,
      data: { costs_total: totalCosts },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Fee Ledger</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          + Add Cost
        </button>
      </div>

      {showForm && <AddCostForm caseId={caseId} onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
      ) : costs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-lg">
          No costs logged yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-center py-2 text-xs font-medium text-muted-foreground">Paid</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${COST_TYPE_COLOR[cost.cost_type]}`}>
                      {COST_TYPE_LABEL[cost.cost_type]}
                    </span>
                  </td>
                  <td className="py-2 text-xs max-w-[200px] truncate">{cost.description}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{fmt(cost.amount)}</td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={cost.paid}
                      onChange={() =>
                        updateCost.mutate({
                          id: cost.id,
                          case_id: caseId,
                          data: { paid: !cost.paid, paid_at: !cost.paid ? new Date().toISOString().slice(0, 10) : null },
                        })
                      }
                      className="h-4 w-4 accent-green-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteCost.mutate({ id: cost.id, case_id: caseId })}
                      className="text-xs text-muted-foreground hover:text-destructive px-1"
                      title="Remove cost"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td colSpan={2} className="pt-2 text-xs text-muted-foreground">Totals</td>
                <td className="pt-2 text-right tabular-nums">{fmt(totalCosts)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr className="text-xs text-muted-foreground">
                <td colSpan={2} className="py-0.5">Medical Liens</td>
                <td className="py-0.5 text-right tabular-nums">{fmt(totalLiens)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr className="text-xs text-muted-foreground">
                <td colSpan={2} className="py-0.5">Unpaid</td>
                <td className="py-0.5 text-right tabular-nums text-amber-600">{fmt(totalUnpaid)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {settlement && costs.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Calculator costs_total: <span className="font-medium">{fmt(settlement.costs_total)}</span>
            {settlement.costs_total !== totalCosts && (
              <span className="text-amber-600 ml-2">← out of sync ({fmt(totalCosts)} in ledger)</span>
            )}
          </p>
          <button
            onClick={syncToCalculator}
            disabled={updateSettlement.isPending || settlement.costs_total === totalCosts}
            className="text-xs px-3 py-1 border rounded hover:bg-muted disabled:opacity-40"
          >
            Sync to Calculator
          </button>
        </div>
      )}
    </div>
  );
}
