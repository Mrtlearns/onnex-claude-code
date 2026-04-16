import { Link } from 'react-router-dom';
import { Ghost, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiGet, API_BASE } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { Lead } from '@/types';

function daysInactive(lead: Lead): number {
  const ref = lead.last_contact_at ?? lead.created_at;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
}

function useResurrectionQueue() {
  return useQuery<Lead[]>({
    queryKey: ['resurrection-queue'],
    queryFn: () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const params = new URLSearchParams({
        'status': 'in.(new,contacted,intake-in-progress)',
        'or': `(last_contact_at.lt.${thirtyDaysAgo},and(last_contact_at.is.null,created_at.lt.${thirtyDaysAgo}))`,
        'select': 'id,first_name,last_name,status,last_contact_at,created_at',
        'order': 'last_contact_at.asc.nullslast',
        'limit': '20',
      });
      return apiGet<Lead[]>(`${API_BASE}/leads?${params.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function ResurrectionQueueWidget() {
  const { data: leads, isLoading } = useResurrectionQueue();

  const queue = leads ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Resurrection Queue</CardTitle>
          </div>
          {queue.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5">
              {queue.length} lead{queue.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <CardDescription>Leads inactive for 30+ days — candidates for re-engagement</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && queue.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No inactive leads — great job staying on top of follow-ups!</p>
        )}

        {!isLoading && queue.length > 0 && (
          <div className="space-y-1">
            {queue.slice(0, 5).map((lead) => {
              const days = daysInactive(lead);
              return (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors group text-sm"
                >
                  <span className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                    days >= 90 ? 'bg-red-100 text-red-700' :
                    days >= 60 ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700',
                  ].join(' ')}>
                    {days}d
                  </span>
                  <span className="flex-1 font-medium text-gray-900 truncate">
                    {lead.first_name} {lead.last_name}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                </Link>
              );
            })}
            {queue.length > 5 && (
              <Link
                to="/leads"
                className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline pt-1"
              >
                +{queue.length - 5} more <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
