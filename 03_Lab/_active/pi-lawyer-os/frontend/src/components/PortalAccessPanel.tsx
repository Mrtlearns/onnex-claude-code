import { useState } from 'react';
import { ExternalLink, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, API_BASE, AUTH_BASE } from '@/lib/api';
import type { ClientUser } from '@/types';

interface Props {
  caseId: string;
  clientId: string | null;
  firmId: string;
  firmSlug: string;
}

export default function PortalAccessPanel({ clientId, firmSlug }: Props) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: clientUsers, isLoading } = useQuery<ClientUser[]>({
    queryKey: ['client-users', clientId],
    queryFn: () =>
      clientId
        ? apiGet<ClientUser[]>(`${API_BASE}/client_users?client_id=eq.${clientId}&order=created_at.desc`)
        : Promise.resolve([]),
    enabled: !!clientId,
  });

  const createAccess = useMutation<ClientUser, Error, { client_id: string; email: string; password: string }>({
    mutationFn: (body) =>
      apiPost<ClientUser>(`${AUTH_BASE}/portal-register`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-users', clientId] });
      setEmail('');
      setPassword('');
      setSuccessMsg('Portal account created. Share the firm slug and credentials with the client.');
      setTimeout(() => setSuccessMsg(null), 6000);
    },
  });

  if (!clientId) {
    return (
      <p className="text-sm text-gray-400 py-2">No client linked to this case. Link a client first.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Client Portal Access</h3>
        <a
          href={`/portal/login?firm=${encodeURIComponent(firmSlug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Preview portal login
        </a>
      </div>

      {/* Existing portal accounts */}
      {isLoading && <p className="text-sm text-gray-400">Loading accounts…</p>}
      {!isLoading && clientUsers && clientUsers.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {clientUsers.map((cu) => (
            <div key={cu.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="font-medium text-gray-800">{cu.email}</span>
              <span className={[
                'text-xs rounded-full px-2 py-0.5',
                cu.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
              ].join(' ')}>
                {cu.active ? 'Active' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!clientUsers || clientUsers.length === 0) && (
        <p className="text-sm text-gray-400">No portal accounts yet.</p>
      )}

      {/* Create account form */}
      <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="w-4 h-4 text-indigo-500" />
          <p className="text-sm font-medium text-gray-700">Create portal account</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="portal-email" className="text-xs">Email</Label>
            <Input
              id="portal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="portal-password" className="text-xs">Temporary password</Label>
            <Input
              id="portal-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 8 characters"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {createAccess.isError && (
          <p className="text-xs text-red-600">{createAccess.error.message}</p>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-3 py-2">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            {successMsg}
          </div>
        )}

        <Button
          size="sm"
          disabled={!email || !password || createAccess.isPending}
          onClick={() => createAccess.mutate({ client_id: clientId!, email, password })}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {createAccess.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating…</>
          ) : (
            'Create Account'
          )}
        </Button>

        <p className="text-xs text-gray-400">
          Firm identifier: <span className="font-mono font-medium text-gray-600">{firmSlug || '—'}</span>
          {' '}— share this along with the email + password with the client.
        </p>
      </div>
    </div>
  );
}
