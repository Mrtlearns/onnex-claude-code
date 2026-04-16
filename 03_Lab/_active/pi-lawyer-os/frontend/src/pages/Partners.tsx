import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Users2, Phone, Mail, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePartners, useCreatePartner } from '@/hooks/usePartners';
import type { PartnerType } from '@/types';

// ── Constants ─────────────────────────────────────────────

const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  attorney: 'Attorney',
  medical: 'Medical Provider',
  chiropractor: 'Chiropractor',
  other: 'Other',
};

const PARTNER_TYPE_COLOR: Record<PartnerType, string> = {
  attorney: 'bg-blue-100 text-blue-800',
  medical: 'bg-green-100 text-green-800',
  chiropractor: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-600',
};

// ── Add Partner Form ──────────────────────────────────────

function AddPartnerForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PartnerType>('other');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const create = useCreatePartner();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      partner_type: type,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dr. John Martinez"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as PartnerType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="attorney">Attorney</SelectItem>
              <SelectItem value="medical">Medical Provider</SelectItem>
              <SelectItem value="chiropractor">Chiropractor</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(702) 555-0100"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Chiro on Flamingo, high volume referrals"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          {create.isPending ? 'Adding…' : 'Add Partner'}
        </Button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────

export default function Partners() {
  const [typeFilter, setTypeFilter] = useState<PartnerType | 'all'>('all');
  const [open, setOpen] = useState(false);

  const { data: partners, isLoading } = usePartners(
    typeFilter !== 'all' ? { type: typeFilter, active: true } : { active: true }
  );

  const filtered = partners ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
          <p className="text-sm text-gray-500 mt-0.5">Referral sources — attorneys, medical providers, chiropractors</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Referral Partner</DialogTitle>
            </DialogHeader>
            <AddPartnerForm onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['all', 'attorney', 'medical', 'chiropractor', 'other'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors capitalize',
              typeFilter === t
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {t === 'all' ? 'All' : PARTNER_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Users2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No partners yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add referring attorneys and medical providers to start tracking referrals.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {filtered.map((partner) => (
            <Link
              key={partner.id}
              to={`/partners/${partner.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{partner.name}</p>
                  <span className={[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0',
                    PARTNER_TYPE_COLOR[partner.partner_type],
                  ].join(' ')}>
                    {PARTNER_TYPE_LABEL[partner.partner_type]}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-0.5">
                  {partner.phone && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{partner.phone}
                    </span>
                  )}
                  {partner.email && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />{partner.email}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
