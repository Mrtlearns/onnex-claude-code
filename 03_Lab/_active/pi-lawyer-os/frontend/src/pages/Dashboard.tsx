import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Zap,
  PhoneMissed,
  Users,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Circle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { dashboardKeys } from '@/hooks/useDashboardStats';
import { useSolAlerts, useTasksDue } from '@/hooks/useSolAlerts';
import { Link } from 'react-router-dom';
import ResurrectionQueueWidget from '@/components/ResurrectionQueueWidget';
import ReferralStatsWidget from '@/components/ReferralStatsWidget';
import RecentActivityPanel from '@/components/RecentActivityPanel';
import type { LeadStatus } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: '#3b82f6',
  contacted: '#f59e0b',
  'intake-in-progress': '#f97316',
  signed: '#22c55e',
  lost: '#6b7280',
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  'intake-in-progress': 'Intake In Progress',
  signed: 'Signed',
  lost: 'Lost',
};

const ACTIVE_STATUSES: LeadStatus[] = ['new', 'contacted', 'intake-in-progress'];

const CARD_MOTION = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
});

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-8 w-20 rounded bg-gray-200 animate-pulse" />
        <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full rounded bg-gray-200 animate-pulse" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="col-span-full border-red-200 bg-red-50">
      <CardContent className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-medium text-red-700">Failed to load dashboard data</p>
            <p className="text-sm text-red-500 mt-0.5">
              One or more KPI queries returned an error. Check your network connection or API.
            </p>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  subStat: string;
  target?: string;
  targetMet?: boolean | null; // null = no target
  icon: React.ReactNode;
  accentColor: string; // tailwind bg class for icon bg
  iconColor: string;   // tailwind text class for icon
  delay: number;
}

function KpiCard({
  title,
  value,
  subStat,
  target,
  targetMet,
  icon,
  accentColor,
  iconColor,
  delay,
}: KpiCardProps) {
  return (
    <motion.div {...CARD_MOTION(delay)}>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
          <div className={`rounded-lg p-2 ${accentColor}`}>
            <span className={iconColor}>{icon}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
          <p className="text-xs text-gray-500">{subStat}</p>
          {target !== undefined && targetMet !== null && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {targetMet ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              )}
              <span
                className={`text-xs font-medium ${
                  targetMet ? 'text-green-600' : 'text-orange-500'
                }`}
              >
                Target: {target}
              </span>
            </div>
          )}
          {target !== undefined && targetMet === null && (
            <p className="text-xs text-gray-400 pt-0.5">Target: {target}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: { fill: string };
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: item.payload.fill }}
        />
        <span className="font-medium text-gray-700">{item.name}</span>
        <span className="text-gray-500">— {item.value}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useDashboardStats();
  const { data: solAlerts } = useSolAlerts();
  const { data: tasksDue } = useTasksDue();

  function handleRetry() {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  }

  // ---- Loading state -------------------------------------------------------
  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  // ---- Error state ---------------------------------------------------------
  if (isError || !data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="grid grid-cols-1">
          <ErrorCard onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  // ---- Derived values ------------------------------------------------------

  // KPI 1 — Speed to Lead
  const avgResponseMin = data.response_time?.avg_response_minutes ?? null;
  const speedValue =
    avgResponseMin !== null ? `${avgResponseMin.toFixed(1)} min` : '—';
  const speedSubStat =
    data.response_time
      ? `${data.response_time.within_2_min_count} lead${
          data.response_time.within_2_min_count !== 1 ? 's' : ''
        } responded within 2 min`
      : 'No data';
  const speedTargetMet =
    avgResponseMin !== null ? avgResponseMin <= 2 : null;

  // KPI 2 — Missed Call Recovery
  const recoveryPct = data.recovery_rate?.recovery_rate_pct ?? null;
  const recoveryValue = recoveryPct !== null ? `${recoveryPct.toFixed(0)}%` : '—';
  const recoverySubStat =
    data.recovery_rate
      ? `${data.recovery_rate.missed_recovered} of ${data.recovery_rate.total_missed_calls} calls recovered`
      : 'No data';
  const recoveryTargetMet =
    recoveryPct !== null ? recoveryPct >= 40 : null;

  // KPI 3 — Active Leads
  const activeLeadCount = ACTIVE_STATUSES.reduce((sum, status) => {
    const entry = data.leads_by_status.find((l) => l.status === status);
    return sum + (entry?.count ?? 0);
  }, 0);
  const signedCount =
    data.leads_by_status.find((l) => l.status === 'signed')?.count ?? 0;
  const activeLeadsSubStat = `${signedCount} signed`;

  // KPI 4 — Intake Completion
  const completionPct = data.intake_completion?.completion_rate_pct ?? null;
  const completionValue =
    completionPct !== null ? `${completionPct.toFixed(0)}%` : '—';
  const completionSubStat =
    data.intake_completion
      ? `${data.intake_completion.signed} of ${data.intake_completion.started_intake} completed`
      : 'No data';
  const completionTargetMet =
    completionPct !== null ? completionPct >= 60 : null;

  // Chart data
  const pieData = data.leads_by_status
    .filter((l) => l.count > 0)
    .map((l) => ({
      name: STATUS_LABELS[l.status] ?? l.status,
      value: l.count,
      fill: STATUS_COLORS[l.status] ?? '#94a3b8',
    }));

  // ---- Render --------------------------------------------------------------
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Badge variant="outline" className="text-xs text-gray-500 gap-1.5">
          <Circle className="h-2 w-2 fill-green-500 text-green-500" />
          Live data
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Speed to Lead"
          value={speedValue}
          subStat={speedSubStat}
          target="< 2 min"
          targetMet={speedTargetMet}
          icon={<Zap className="h-4 w-4" />}
          accentColor="bg-blue-100"
          iconColor="text-blue-600"
          delay={0}
        />
        <KpiCard
          title="Missed Call Recovery"
          value={recoveryValue}
          subStat={recoverySubStat}
          target="> 40%"
          targetMet={recoveryTargetMet}
          icon={<PhoneMissed className="h-4 w-4" />}
          accentColor="bg-green-100"
          iconColor="text-green-600"
          delay={0.1}
        />
        <KpiCard
          title="Active Leads"
          value={activeLeadCount.toString()}
          subStat={activeLeadsSubStat}
          target={undefined}
          targetMet={null}
          icon={<Users className="h-4 w-4" />}
          accentColor="bg-purple-100"
          iconColor="text-purple-600"
          delay={0.2}
        />
        <KpiCard
          title="Intake Completion"
          value={completionValue}
          subStat={completionSubStat}
          target="60%"
          targetMet={completionTargetMet}
          icon={<ClipboardCheck className="h-4 w-4" />}
          accentColor="bg-orange-100"
          iconColor="text-orange-600"
          delay={0.3}
        />
      </div>

      {/* SOL Alerts */}
      {solAlerts && solAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.35 }} className="mb-6">
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <CardTitle className="text-base text-red-700">SOL Alerts — {solAlerts.length} case{solAlerts.length !== 1 ? 's' : ''} expiring within 90 days</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left py-1.5 pr-4">Client</th>
                      <th className="text-left py-1.5 pr-4">Case #</th>
                      <th className="text-left py-1.5 pr-4">SOL Date</th>
                      <th className="text-left py-1.5">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solAlerts.map((alert) => (
                      <tr key={alert.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 pr-4 font-medium text-gray-900">
                          <Link to={`/cases/${alert.id}`} className="hover:text-blue-600 hover:underline">
                            {alert.client_name ?? '—'}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-4 text-gray-600 font-mono text-xs">{alert.case_number ?? '—'}</td>
                        <td className="py-1.5 pr-4 text-gray-600">{new Date(alert.sol_date).toLocaleDateString()}</td>
                        <td className="py-1.5">
                          <span className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                            alert.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                            alert.urgency === 'urgent' ? 'bg-amber-100 text-amber-800' :
                            'bg-yellow-100 text-yellow-800',
                          ].join(' ')}>
                            {alert.days_until_sol}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tasks Due */}
      {tasksDue && tasksDue.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.38 }} className="mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tasks Due This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {tasksDue.map((task) => (
                  <div key={task.id} className={[
                    'flex items-center gap-3 py-1.5 px-2 rounded-md text-sm',
                    task.urgency === 'overdue' ? 'bg-red-50' : task.urgency === 'due-today' ? 'bg-amber-50' : '',
                  ].join(' ')}>
                    <span className={[
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      task.urgency === 'overdue' ? 'bg-red-500' : task.urgency === 'due-today' ? 'bg-amber-500' : 'bg-gray-300',
                    ].join(' ')} />
                    <span className="flex-1 font-medium text-gray-900 truncate">{task.title}</span>
                    {task.client_name && <span className="text-xs text-gray-500 shrink-0">{task.client_name}</span>}
                    {task.due_date && (
                      <span className={['text-xs shrink-0', task.urgency === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-500'].join(' ')}>
                        {task.urgency === 'overdue' ? 'Overdue — ' : ''}
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Leads by Status donut chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Leads by Status</CardTitle>
              <CardDescription>Current pipeline distribution</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                  No lead data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span className="text-xs text-gray-600">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent activity / quick links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Automations & Activity</CardTitle>
              <CardDescription>Active workflows running 24/7</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Automations active indicator */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-sm font-medium text-green-700">Automations active</span>
              </div>

              {/* Automation checklist */}
              <ul className="space-y-2">
                {[
                  'Speed-to-lead',
                  'Missed call recovery',
                  'Intake reminders',
                  'Retainer follow-up',
                ].map((label) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>

              {/* Divider */}
              <hr className="border-gray-100" />

              {/* Quick link */}
              <a
                href="/leads"
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors group"
              >
                <span>View All Leads</span>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </a>

              {/* Signed leads callout */}
              {signedCount > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-green-700 font-medium">
                    {signedCount} signed client{signedCount !== 1 ? 's' : ''}
                  </span>
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                    Active
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

      </div>

      {/* Revenue Growth row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.55 }}
        >
          <ResurrectionQueueWidget />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.6 }}
        >
          <ReferralStatsWidget />
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.65 }}
        className="mt-4"
      >
        <RecentActivityPanel />
      </motion.div>

    </div>
  );
}
