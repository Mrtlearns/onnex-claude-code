import { useState } from 'react';
import { useSettlementOffers, useCreateSettlementOffer, useUpdateSettlementOffer } from '../hooks/useSettlementOffers';
import type { OfferBy } from '../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const PARTY_LABEL: Record<OfferBy, string> = {
  defense: 'Defense',
  plaintiff: 'Plaintiff',
};

const PARTY_COLOR: Record<OfferBy, string> = {
  defense: 'bg-red-100 text-red-700',
  plaintiff: 'bg-blue-100 text-blue-700',
};

interface AddOfferFormProps {
  caseId: string;
  onClose: () => void;
}

function AddOfferForm({ caseId, onClose }: AddOfferFormProps) {
  const create = useCreateSettlementOffer();
  const [offerBy, setOfferBy] = useState<OfferBy>('defense');
  const [amount, setAmount] = useState('');
  const [offeredAt, setOfferedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!parsed || isNaN(parsed)) return;
    await create.mutateAsync({ case_id: caseId, offer_by: offerBy, amount: parsed, offered_at: offeredAt, notes: notes || undefined });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-muted/40 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Party</label>
          <select
            value={offerBy}
            onChange={(e) => setOfferBy(e.target.value as OfferBy)}
            className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="defense">Defense</option>
            <option value="plaintiff">Plaintiff</option>
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
        <label className="text-xs font-medium text-muted-foreground">Date</label>
        <input
          type="date"
          value={offeredAt}
          onChange={(e) => setOfferedAt(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border rounded-md px-3 py-1.5 text-sm bg-background resize-none"
          placeholder="Optional notes..."
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
          {create.isPending ? 'Saving…' : 'Add Offer'}
        </button>
      </div>
    </form>
  );
}

interface Props {
  caseId: string;
}

export function SettlementPanel({ caseId }: Props) {
  const { data: offers = [], isLoading } = useSettlementOffers(caseId);
  const updateOffer = useUpdateSettlementOffer();
  const [showForm, setShowForm] = useState(false);

  const toggleAccepted = (id: string, current: boolean) => {
    // Unaccept all then accept the target
    offers.forEach((o) => {
      if (o.accepted && o.id !== id) {
        updateOffer.mutate({ id: o.id, case_id: caseId, data: { accepted: false } });
      }
    });
    updateOffer.mutate({ id, case_id: caseId, data: { accepted: !current } });
  };

  const acceptedOffer = offers.find((o) => o.accepted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Settlement Negotiations</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          + Add Offer
        </button>
      </div>

      {showForm && <AddOfferForm caseId={caseId} onClose={() => setShowForm(false)} />}

      {acceptedOffer && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-700 text-lg">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">
              Accepted: {fmt(acceptedOffer.amount)}
            </p>
            <p className="text-xs text-green-600">
              {PARTY_LABEL[acceptedOffer.offer_by]} offer • {acceptedOffer.offered_at}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading…</div>
      ) : offers.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-lg">
          No offers logged yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground">Party</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground pl-3">Notes</th>
                <th className="text-center py-2 text-xs font-medium text-muted-foreground">Accepted</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr
                  key={offer.id}
                  className={`border-b last:border-0 ${offer.accepted ? 'bg-green-50' : 'hover:bg-muted/30'}`}
                >
                  <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{offer.offered_at}</td>
                  <td className="py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PARTY_COLOR[offer.offer_by]}`}>
                      {PARTY_LABEL[offer.offer_by]}
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{fmt(offer.amount)}</td>
                  <td className="py-2 pl-3 text-xs text-muted-foreground max-w-[200px] truncate">{offer.notes ?? '—'}</td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={offer.accepted}
                      onChange={() => toggleAccepted(offer.id, offer.accepted)}
                      className="h-4 w-4 accent-green-600 cursor-pointer"
                      title="Mark as accepted offer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
