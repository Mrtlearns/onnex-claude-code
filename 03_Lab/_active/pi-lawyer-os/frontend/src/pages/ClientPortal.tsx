import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, LogOut, FileText, MessageSquare, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePortalSession, portalLogout } from '@/hooks/usePortalAuth';
import {
  usePortalCase,
  usePortalClient,
  usePortalDocuments,
  usePortalCommunications,
  usePortalSettlement,
} from '@/hooks/usePortalCase';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  intake: 'Intake',
  investigation: 'Investigation',
  demand: 'Demand',
  negotiation: 'Negotiation',
  settlement: 'Settlement',
  litigation: 'Litigation',
  closed: 'Closed',
};

const STATUS_COLOR: Record<string, string> = {
  intake: 'bg-blue-100 text-blue-800',
  investigation: 'bg-yellow-100 text-yellow-800',
  demand: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-purple-100 text-purple-800',
  settlement: 'bg-green-100 text-green-800',
  litigation: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-600',
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// ── Component ────────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const navigate = useNavigate();
  const { isAuthenticated, clientId } = usePortalSession();

  // Redirect to portal login if session expired
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/portal/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // We need the case_id — stored in localStorage after login by usePortalLogin
  const caseId = localStorage.getItem('plo_portal_case_id');

  const { data: caseData, isLoading: caseLoading } = usePortalCase(caseId);
  const { data: client } = usePortalClient(clientId);
  const { data: documents } = usePortalDocuments(caseId);
  const { data: communications } = usePortalCommunications(caseData?.lead_id ?? null);
  const { data: settlement } = usePortalSettlement(caseId);

  function handleLogout() {
    portalLogout();
    localStorage.removeItem('plo_portal_case_id');
    navigate('/portal/login', { replace: true });
  }

  if (caseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-indigo-600">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900">Client Portal</span>
            {client && (
              <span className="text-sm text-gray-500 ml-2">
                — {client.first_name} {client.last_name}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-gray-500">
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Case status */}
        {caseData ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Your Case
                <span className={['text-xs font-semibold rounded-full px-2.5 py-1', STATUS_COLOR[caseData.status] ?? 'bg-gray-100 text-gray-700'].join(' ')}>
                  {STATUS_LABEL[caseData.status] ?? caseData.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              {caseData.case_number && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Case #</p>
                  <p className="font-medium text-gray-900 font-mono">{caseData.case_number}</p>
                </div>
              )}
              {caseData.date_of_loss && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Date of Loss</p>
                  <p className="font-medium text-gray-900">{new Date(caseData.date_of_loss).toLocaleDateString()}</p>
                </div>
              )}
              {caseData.sol_date && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Statute of Limitations</p>
                  <p className="font-medium text-gray-900">{new Date(caseData.sol_date).toLocaleDateString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-gray-400 text-sm">
              No case found for your account.
            </CardContent>
          </Card>
        )}

        {/* Settlement summary */}
        {settlement && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Gross Settlement</p>
                <p className="font-medium text-gray-900">{fmt.format(settlement.gross_settlement)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Net to You</p>
                <p className="font-semibold text-green-700 text-base">{fmt.format(settlement.net_to_client)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Attorney Fee</p>
                <p className="font-medium text-gray-900">{fmt.format(settlement.attorney_fee_amount)} ({settlement.attorney_fee_pct}%)</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Case Costs</p>
                <p className="font-medium text-gray-900">{fmt.format(settlement.costs_total)}</p>
              </div>
              {settlement.settled_at && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Settled On</p>
                  <p className="font-medium text-gray-900">{new Date(settlement.settled_at).toLocaleDateString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Your Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!documents || documents.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No documents have been shared with you yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-gray-800 font-medium">{doc.name}</span>
                    <a
                      href={`/files/${doc.id}`}
                      download={doc.name}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Staff notes (communications channel=note) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Updates from Your Firm
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!communications || communications.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No updates yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 space-y-0">
                {communications.map((comm) => (
                  <li key={comm.id} className="py-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{comm.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(comm.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
