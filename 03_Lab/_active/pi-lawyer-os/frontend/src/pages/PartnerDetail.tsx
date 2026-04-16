import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Check,
  DollarSign,
  Loader2,
  Users2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePartner, useUpdatePartner } from '@/hooks/usePartners';
import { usePartnerReferrals, useUpdateReferral } from '@/hooks/useReferrals';
import type { PartnerType } from '@/types';

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

function CommissionRow({
  referral,
}: {
  referral: {
    id: string;
    lead_id: string | null;
    case_id: string | null;
    commission_amount: number;
    commission_paid: boolean;
    referred_at: string;
    notes: string | null;
  };
}) {
  const update = useUpdateReferral();

  async function markPaid() {
    await update.mutateAsync({ id: referral.id, data: { commission_paid: true } });
  }

  return (
    <div className="flex items-center gap-4 py-3 text-sm border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {referral.case_id ? (
            <Link to={`/cases/${referral.case_id}`} className="font-medium text-blue-600 hover:underline">
              View Case
            </Link>
          ) : referral.lead_id ? (
            <Link to={`/leads/${referral.lead_id}`} className="font-medium text-blue-600 hover:underline">
              View Lead
            </Link>
          ) : (
            <span className="text-gray-400">No link</span>
          )}
          {referral.case_id && (
            <span className="text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5 font-medium">
              Signed
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Referred {new Date(referral.referred_at).toLocaleDateString()}
          {referral.notes && ` · ${referral.notes}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-gray-900">
          ${Number(referral.commission_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
        {referral.commission_paid ? (
          <span className="text-xs text-green-600 flex items-center gap-1 justify-end mt-0.5">
            <Check className="w-3 h-3" />Paid
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2 mt-0.5"
            onClick={markPaid}
            disabled={update.isPending}
          >
            Mark Paid
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const [deactivating, setDeactivating] = useState(false);

  const { data: partner, isLoading, isError } = usePartner(id ?? '');
  const { data: referrals, isLoading: referralsLoading } = usePartnerReferrals(id ?? '');
  const updatePartner = useUpdatePartner();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !partner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 font-medium">Partner not found.</p>
        <Link to="/partners">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Partners
          </Button>
        </Link>
      </div>
    );
  }

  const totalOwed = (referrals ?? [])
    .filter((r) => !r.commission_paid)
    .reduce((sum, r) => sum + Number(r.commission_amount), 0);

  const totalPaid = (referrals ?? [])
    .filter((r) => r.commission_paid)
    .reduce((sum, r) => sum + Number(r.commission_amount), 0);

  const signedReferrals = (referrals ?? []).filter((r) => r.case_id !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/partners">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />Partners
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
            <span className={[
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              PARTNER_TYPE_COLOR[partner.partner_type],
            ].join(' ')}>
              {PARTNER_TYPE_LABEL[partner.partner_type]}
            </span>
            {!partner.active && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">
                Inactive
              </span>
            )}
          </div>
        </div>
        {partner.active && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:border-red-300"
            onClick={async () => {
              setDeactivating(true);
              await updatePartner.mutateAsync({ id: partner.id, data: { active: false } });
              setDeactivating(false);
            }}
            disabled={deactivating}
          >
            {deactivating ? 'Deactivating…' : 'Deactivate'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {partner.phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{partner.phone}</span>
              </div>
            )}
            {partner.email && (
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{partner.email}</span>
              </div>
            )}
            {partner.address && (
              <div className="flex items-start gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span>{partner.address}</span>
              </div>
            )}
            {partner.notes && (
              <p className="text-xs text-gray-500 pt-1 border-t border-gray-100 mt-2">{partner.notes}</p>
            )}
            {!partner.phone && !partner.email && !partner.address && !partner.notes && (
              <p className="text-gray-400 text-sm">No contact details.</p>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Referral Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{(referrals ?? []).length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total Referrals</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">{signedReferrals}</p>
                <p className="text-xs text-gray-500 mt-0.5">Signed / Won</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {(referrals ?? []).length > 0
                    ? Math.round((signedReferrals / (referrals ?? []).length) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Conversion Rate</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-orange-700">
                    ${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500">Commissions Owed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <div>
                  <p className="text-sm font-semibold text-green-700">
                    ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500">Total Paid</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Referral History</CardTitle></CardHeader>
        <CardContent>
          {referralsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
          {!referralsLoading && (referrals ?? []).length === 0 && (
            <div className="text-center py-8">
              <Users2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No referrals recorded yet.</p>
            </div>
          )}
          {!referralsLoading && (referrals ?? []).length > 0 && (
            <div>
              {(referrals ?? []).map((r) => (
                <CommissionRow key={r.id} referral={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
