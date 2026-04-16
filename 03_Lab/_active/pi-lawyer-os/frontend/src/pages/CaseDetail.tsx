import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCase } from '@/hooks/useCase';
import { useCaseClient } from '@/hooks/useCase';
import { useUpdateCase } from '@/hooks/useCases';
import { useCurrentUser } from '@/hooks/useAuth';
import MedicalProviderPanel from '@/components/MedicalProviderPanel';
import TaskPanel from '@/components/TaskPanel';
import DocumentPanel from '@/components/DocumentPanel';
import DemandLetterPanel from '@/components/DemandLetterPanel';
import { SettlementPanel } from '@/components/SettlementPanel';
import { FeeLedgerPanel } from '@/components/FeeLedgerPanel';
import { DisbursementPanel } from '@/components/DisbursementPanel';
import { SettlementSummaryPanel } from '@/components/SettlementSummaryPanel';
import { useCaseSettlement } from '@/hooks/useCaseSettlement';
import PortalAccessPanel from '@/components/PortalAccessPanel';
import SimilarCasesPanel from '@/components/SimilarCasesPanel';
import AuditLogPanel from '@/components/AuditLogPanel';
import type { CaseStatus, CaseType } from '@/types';

// ── Constants ──────────────────────────────────────────────

const CASE_TYPE_LABEL: Record<CaseType, string> = {
  auto: 'Auto Accident',
  'slip-fall': 'Slip & Fall',
  'dog-bite': 'Dog Bite',
  'premises-liability': 'Premises Liability',
  other: 'Other',
};

const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'demand', label: 'Demand' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'litigation', label: 'Litigation' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_COLOR: Record<CaseStatus, string> = {
  intake: 'bg-blue-100 text-blue-800',
  investigation: 'bg-yellow-100 text-yellow-800',
  demand: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-purple-100 text-purple-800',
  settlement: 'bg-green-100 text-green-800',
  litigation: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-600',
};

type Tab = 'overview' | 'medical' | 'tasks' | 'documents' | 'demand' | 'billing' | 'portal';

const TABS: { id: Tab; label: string; minStatus?: CaseStatus }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'medical', label: 'Medical' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'documents', label: 'Documents' },
  { id: 'demand', label: 'Demand Letter', minStatus: 'demand' },
  { id: 'billing', label: 'Billing', minStatus: 'negotiation' },
  { id: 'portal', label: 'Client Portal' },
];

// ── SOL badge ─────────────────────────────────────────────

function SolBadge({ solDate }: { solDate: string | null }) {
  if (!solDate) return <span className="text-gray-400 text-sm">No SOL set</span>;
  const days = Math.floor((new Date(solDate).getTime() - Date.now()) / 86400000);
  const formatted = new Date(solDate).toLocaleDateString();

  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-600 text-white">
        <AlertTriangle className="w-3.5 h-3.5" />PAST SOL — {formatted}
      </span>
    );
  if (days <= 30)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800">
        <AlertTriangle className="w-3.5 h-3.5" />{days}d — {formatted}
      </span>
    );
  if (days <= 60)
    return <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800">{days}d — {formatted}</span>;
  if (days <= 90)
    return <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800">{days}d — {formatted}</span>;
  return <span className="text-sm text-gray-600">{formatted}</span>;
}

// ── Page ───────────────────────────────────────────────────

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: caseData, isLoading, isError } = useCase(id ?? '');
  const { data: client } = useCaseClient(caseData?.client_id);
  const { data: currentUser } = useCurrentUser();
  const updateCase = useUpdateCase();
  const { data: settlement } = useCaseSettlement(id ?? '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading case…</span>
      </div>
    );
  }

  if (isError || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 font-medium">Case not found.</p>
        <Link to="/cases">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Cases
          </Button>
        </Link>
      </div>
    );
  }

  const firmId = currentUser?.firm_id ?? caseData.firm_id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />Cases
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {client ? `${client.first_name} ${client.last_name}` : 'Case'}
            </h1>
            {caseData.case_number && (
              <span className="text-sm text-gray-500 font-mono">{caseData.case_number}</span>
            )}
            <span className={['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_COLOR[caseData.status]].join(' ')}>
              {STATUS_OPTIONS.find((s) => s.value === caseData.status)?.label ?? caseData.status}
            </span>
            {settlement && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                💰 Settled {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(settlement.gross_settlement)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-gray-500">{CASE_TYPE_LABEL[caseData.case_type]}</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500 flex items-center gap-1.5">
              SOL: <SolBadge solDate={caseData.sol_date} />
            </span>
          </div>
        </div>
        {/* Status changer */}
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={caseData.status}
            onValueChange={(v) => updateCase.mutate({ id: caseData.id, data: { status: v as CaseStatus } })}
            disabled={updateCase.isPending}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.filter((tab) => {
          if (!tab.minStatus) return true;
          const order: CaseStatus[] = ['intake','investigation','demand','negotiation','settlement','litigation','closed'];
          return order.indexOf(caseData.status) >= order.indexOf(tab.minStatus);
        }).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              activeTab === tab.id
                ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {client ? (
                  <>
                    <Field label="Name" value={`${client.first_name} ${client.last_name}`} />
                    <Field label="DOB" value={client.dob ? new Date(client.dob).toLocaleDateString() : '—'} />
                    <Field label="Phone" value={client.phone ?? '—'} />
                    <Field label="Email" value={client.email ?? '—'} />
                    <Field label="Insurance" value={client.insurance_carrier ?? '—'} />
                    <Field label="Policy #" value={client.insurance_policy ?? '—'} />
                    {client.address && <Field label="Address" value={client.address} className="col-span-2" />}
                  </>
                ) : (
                  <p className="col-span-2 text-gray-400 text-sm">No client linked.</p>
                )}
              </CardContent>
            </Card>

            {/* Case facts */}
            <Card>
              <CardHeader><CardTitle className="text-base">Case Facts</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="Case Type" value={CASE_TYPE_LABEL[caseData.case_type]} />
                <Field label="Date of Loss" value={caseData.date_of_loss ? new Date(caseData.date_of_loss).toLocaleDateString() : '—'} />
                <Field label="SOL Date" value={caseData.sol_date ? new Date(caseData.sol_date).toLocaleDateString() : '—'} />
                <Field label="Opened" value={new Date(caseData.opened_at).toLocaleDateString()} />
                {caseData.description && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Description</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{caseData.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Similar cases */}
          <Card>
            <CardHeader><CardTitle className="text-base">Similar Cases</CardTitle></CardHeader>
            <CardContent>
              <SimilarCasesPanel caseId={caseData.id} />
            </CardContent>
          </Card>

          {/* Audit log */}
          <AuditLogPanel entityType="case" entityId={caseData.id} />
        </div>
      )}

      {activeTab === 'medical' && (
        <Card>
          <CardContent className="pt-6">
            <MedicalProviderPanel caseId={caseData.id} firmId={firmId} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'tasks' && (
        <Card>
          <CardContent className="pt-6">
            <TaskPanel caseId={caseData.id} firmId={firmId} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardContent className="pt-6">
            <DocumentPanel caseId={caseData.id} firmId={firmId} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'demand' && (
        <Card>
          <CardContent className="pt-6">
            <DemandLetterPanel caseId={caseData.id} />
          </CardContent>
        </Card>
      )}

      {activeTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <SettlementPanel caseId={caseData.id} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <FeeLedgerPanel caseId={caseData.id} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <DisbursementPanel caseId={caseData.id} caseData={caseData} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <SettlementSummaryPanel caseId={caseData.id} caseData={caseData} clientData={client} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'portal' && (
        <Card>
          <CardContent className="pt-6">
            <PortalAccessPanel caseId={caseData.id} clientId={caseData.client_id} firmId={firmId} firmSlug={currentUser?.firm_slug ?? ''} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}
