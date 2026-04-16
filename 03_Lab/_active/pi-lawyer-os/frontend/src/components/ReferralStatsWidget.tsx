import { Link } from 'react-router-dom';
import { Handshake, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, API_BASE } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { Partner, PartnerReferral } from '@/types';

function useReferralStats() {
  const partners = useQuery<Partner[]>({
    queryKey: ['referral-stats-partners'],
    queryFn: () => apiGet<Partner[]>(`${API_BASE}/partners?active=eq.true&select=id`),
    staleTime: 5 * 60 * 1000,
  });

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const referrals = useQuery<PartnerReferral[]>({
    queryKey: ['referral-stats-referrals'],
    queryFn: () =>
      apiGet<PartnerReferral[]>(
        `${API_BASE}/partner_referrals?select=id,case_id,commission_amount,commission_paid,referred_at`
      ),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = partners.isLoading || referrals.isLoading;

  const allReferrals = referrals.data ?? [];
  const thisMonthReferrals = allReferrals.filter(
    (r) => new Date(r.referred_at) >= firstOfMonth
  );
  const signedReferrals = allReferrals.filter((r) => r.case_id !== null);
  const conversionRate =
    allReferrals.length > 0
      ? Math.round((signedReferrals.length / allReferrals.length) * 100)
      : 0;
  const commissionsOwed = allReferrals
    .filter((r) => !r.commission_paid)
    .reduce((sum, r) => sum + Number(r.commission_amount), 0);

  return {
    isLoading,
    totalPartners: partners.data?.length ?? 0,
    thisMonthReferrals: thisMonthReferrals.length,
    conversionRate,
    commissionsOwed,
  };
}

export default function ReferralStatsWidget() {
  const stats = useReferralStats();

  if (stats.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">Referral Network</CardTitle>
          </div>
          <Link to="/partners" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Stat label="Active Partners" value={stats.totalPartners.toString()} />
            <Stat label="Referrals This Month" value={stats.thisMonthReferrals.toString()} />
          </div>
          <div className="space-y-3">
            <Stat label="Conversion Rate" value={`${stats.conversionRate}%`} />
            <Stat
              label="Commissions Owed"
              value={`$${stats.commissionsOwed.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
              valueClass={stats.commissionsOwed > 0 ? 'text-orange-600' : 'text-gray-900'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  valueClass = 'text-gray-900',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}
