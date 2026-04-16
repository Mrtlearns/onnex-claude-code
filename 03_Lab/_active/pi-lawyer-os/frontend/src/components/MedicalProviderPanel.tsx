import { useState } from 'react';
import { PlusCircle, Edit2, Check, DollarSign, Brain } from 'lucide-react';
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
import { useMedicalProviders, useMedicalProvidersSpecialsTotal, useCreateMedicalProvider, useUpdateMedicalProvider } from '@/hooks/useMedicalProviders';
import { useCaseMedicalAnalyses } from '@/hooks/useDocuments';
import MedicalAiSummary from '@/components/MedicalAiSummary';
import type { MedicalProvider, MedicalRequestStatus } from '@/types';

const REQUEST_STATUS_LABEL: Record<MedicalRequestStatus, string> = {
  'not-requested': 'Not Requested',
  requested: 'Requested',
  received: 'Received',
  reviewed: 'Reviewed',
};

const REQUEST_STATUS_COLOR: Record<MedicalRequestStatus, string> = {
  'not-requested': 'bg-gray-100 text-gray-600',
  requested: 'bg-yellow-100 text-yellow-700',
  received: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-green-100 text-green-700',
};

interface AddProviderFormProps {
  caseId: string;
  firmId: string;
  onDone: () => void;
}

function AddProviderForm({ caseId, onDone }: AddProviderFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('other');
  const [lien, setLien] = useState('');
  const create = useCreateMedicalProvider();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({
      case_id: caseId,
      name: name.trim(),
      provider_type: type,
      request_status: 'not-requested',
      requested_at: null,
      received_at: null,
      lien_amount: parseFloat(lien) || 0,
      notes: null,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Provider Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunrise Medical Center" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hospital">Hospital / ER</SelectItem>
              <SelectItem value="chiropractor">Chiropractor</SelectItem>
              <SelectItem value="specialist">Specialist</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lien Amount ($)</Label>
          <Input type="number" min="0" step="0.01" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
          {create.isPending ? 'Adding…' : 'Add Provider'}
        </Button>
      </div>
    </form>
  );
}

interface ProviderRowProps {
  provider: MedicalProvider;
}

function ProviderRow({ provider }: ProviderRowProps) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<MedicalRequestStatus>(provider.request_status);
  const [lien, setLien] = useState(String(provider.lien_amount ?? 0));
  const update = useUpdateMedicalProvider();

  async function save() {
    await update.mutateAsync({
      id: provider.id,
      data: { request_status: status, lien_amount: parseFloat(lien) || 0 },
    });
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 text-sm">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{provider.name}</p>
        <p className="text-xs text-gray-500 capitalize">{provider.provider_type}</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <Select value={status} onValueChange={(v) => setStatus(v as MedicalRequestStatus)}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_STATUS_LABEL) as MedicalRequestStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            className="w-24 h-7 text-xs"
            value={lien}
            onChange={(e) => setLien(e.target.value)}
          />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save} disabled={update.isPending}>
            <Check className="w-3.5 h-3.5 text-green-600" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <span className={['text-xs font-medium rounded-full px-2 py-0.5', REQUEST_STATUS_COLOR[provider.request_status]].join(' ')}>
            {REQUEST_STATUS_LABEL[provider.request_status]}
          </span>
          <span className="text-xs text-gray-600 w-20 text-right">
            ${Number(provider.lien_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>
            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface MedicalProviderPanelProps {
  caseId: string;
  firmId: string;
}

export default function MedicalProviderPanel({ caseId, firmId }: MedicalProviderPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const { data: providers, isLoading } = useMedicalProviders(caseId);
  const total = useMedicalProvidersSpecialsTotal(caseId);
  const { data: medicalAnalyses } = useCaseMedicalAnalyses(caseId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Medical Providers</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} disabled={showAdd}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          Add Provider
        </Button>
      </div>

      {showAdd && (
        <AddProviderForm caseId={caseId} firmId={firmId} onDone={() => setShowAdd(false)} />
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading providers…</p>}

      {!isLoading && providers?.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 py-4 text-center">No medical providers added yet.</p>
      )}

      {providers && providers.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 px-3">
          {providers.map((p) => <ProviderRow key={p.id} provider={p} />)}
        </div>
      )}

      {/* AI medical analyses */}
      {medicalAnalyses && medicalAnalyses.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-purple-700 flex items-center gap-1">
            <Brain className="w-3.5 h-3.5" />
            AI Extracted Medical Data
          </p>
          {medicalAnalyses.map((a, i) => (
            <MedicalAiSummary key={i} analysis={a} />
          ))}
        </div>
      )}

      {/* Specials total */}
      {providers && providers.length > 0 && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">
            Medical Specials Total:
          </span>
          <span className="text-sm font-bold text-gray-900">
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}
