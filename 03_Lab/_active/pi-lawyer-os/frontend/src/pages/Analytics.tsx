import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, TrendingUp, Users, Briefcase, Handshake, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAnalyticsCaseSummary,
  useAnalyticsLeadFunnel,
  useAnalyticsReferralAttribution,
  useAnalyticsPartnerPerformance,
  useAttorneyPerformance,
} from '@/hooks/useAnalytics';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const FUNNEL_COLORS: Record<string, string> = {
  new: '#6366f1',
  contacted: '#8b5cf6',
  'intake-in-progress': '#ec4899',
  signed: '#10b981',
  lost: '#6b7280',
};

const FUNNEL_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'intake-in-progress': 'Intake',
  signed: 'Signed',
  lost: 'Lost',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsCaseSummary();
  const { data: funnel, isLoading: funnelLoading } = useAnalyticsLeadFunnel();
  const { data: referral } = useAnalyticsReferralAttribution();
  const { data: partners } = useAnalyticsPartnerPerformance();
  const { data: attorneys } = useAttorneyPerformance();

  const isLoading = summaryLoading || funnelLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading analytics…</span>
      </div>
    );
  }

  // Normalise funnel for chart
  const funnelData = (funnel ?? []).map((row) => ({
    name: FUNNEL_LABEL[row.status] ?? row.status,
    count: row.count,
    color: FUNNEL_COLORS[row.status] ?? '#94a3b8',
  }));

  // Normalise referral attribution
  const referralData = (referral ?? []).slice(0, 8).map((row) => ({
    name: row.source,
    leads: row.total_leads,
    signed: row.signed_leads,
    conversion: row.conversion_pct,
  }));

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Firm-wide performance overview</p>
      </div>

      {/* Case KPI tiles */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Case Summary</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Cases" value={String(summary?.total_cases ?? 0)} />
          <StatCard label="Settled" value={String(summary?.settled_cases ?? 0)} sub={`${summary?.settlement_rate_pct ?? 0}% rate`} />
          <StatCard label="Avg Settlement" value={fmt.format(Number(summary?.avg_settlement ?? 0))} />
          <StatCard label="Total Attorney Fees" value={fmt.format(Number(summary?.total_attorney_fees ?? 0))} />
        </div>
      </section>

      {/* Lead funnel */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Lead Funnel</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            {funnelData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No lead data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6 }}
                    cursor={{ fill: '#f9fafb' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Source Attribution */}
      {referralData.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Source Attribution</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={referralData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6 }}
                    cursor={{ fill: '#f9fafb' }}
                    formatter={(value, name, props) => {
                      if (name === 'Total Leads') return [value, 'Total Leads'];
                      if (name === 'Signed') return [`${value} (${props.payload.conversion}% conv.)`, 'Signed'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="leads" name="Total Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="signed" name="Signed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* Conversion rate table */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wide">
                      <th className="text-left font-medium pb-2">Source</th>
                      <th className="text-right font-medium pb-2">Leads</th>
                      <th className="text-right font-medium pb-2">Signed</th>
                      <th className="text-right font-medium pb-2">Conv. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralData.map((row) => (
                      <tr key={row.name} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-4 font-medium text-gray-700 capitalize">{row.name}</td>
                        <td className="py-1.5 pr-4 text-right text-gray-600">{row.leads}</td>
                        <td className="py-1.5 pr-4 text-right text-gray-600">{row.signed}</td>
                        <td className="py-1.5 text-right">
                          <span className={Number(row.conversion) >= 50 ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                            {row.conversion}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Attorney performance table */}
      {attorneys && attorneys.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Attorney Performance</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Case outcomes by attorney</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Attorney</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Total Cases</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Open</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Settled This Year</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Avg Settlement</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Avg Days</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2">Total Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attorneys.map((a) => (
                      <tr key={a.attorney_id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-900">{a.attorney_name}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{a.total_cases}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{a.open_cases}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{a.settled_this_year}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">
                          {a.avg_gross_settlement ? fmt.format(Number(a.avg_gross_settlement)) : '—'}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-700">
                          {a.avg_days_to_settle ? `${a.avg_days_to_settle}d` : '—'}
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900">
                          {fmt.format(Number(a.total_fees_earned))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Partner performance table */}
      {partners && partners.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Handshake className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Partner Performance</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Referral partners by volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Partner</th>
                      <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">Type</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Referrals</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Signed</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pr-4">Conv. %</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2">Comm. Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p) => (
                      <tr key={p.partner_id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-900">{p.name}</td>
                        <td className="py-2 pr-4 text-gray-500 capitalize">{p.partner_type}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{p.total_referrals}</td>
                        <td className="py-2 pr-4 text-right text-gray-700">{p.signed_referrals}</td>
                        <td className="py-2 pr-4 text-right">
                          <span className={Number(p.conversion_pct) >= 50 ? 'text-green-600 font-medium' : 'text-gray-600'}>
                            {p.conversion_pct}%
                          </span>
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900">
                          {fmt.format(Number(p.commissions_owed))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
