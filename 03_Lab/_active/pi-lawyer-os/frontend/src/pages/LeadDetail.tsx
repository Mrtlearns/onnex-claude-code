import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Mail,
  StickyNote,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Briefcase,
  Sparkles,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLead, useLeadCommunications, useAddNote } from '@/hooks/useLead';
import { useUpdateLead } from '@/hooks/useLeads';
import { usePartners } from '@/hooks/usePartners';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import CaseCreateForm from '@/components/CaseCreateForm';
import { useCurrentUser } from '@/hooks/useAuth';
import { relativeTime } from '@/lib/utils';
import { apiPost } from '@/lib/api';
import type { LeadStatus, InjuryType, LeadSource, Communication, IntakeSummary } from '@/types';
import { Handshake } from 'lucide-react';
import AuditLogPanel from '@/components/AuditLogPanel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'intake-in-progress', label: 'Intake In Progress' },
  { value: 'signed', label: 'Signed' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  'intake-in-progress': 'bg-orange-100 text-orange-800',
  signed: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-600',
};

const INJURY_LABEL: Record<InjuryType, string> = {
  auto: 'Auto Accident',
  'slip-fall': 'Slip & Fall',
  'dog-bite': 'Dog Bite',
  'premises-liability': 'Premises Liability',
  other: 'Other',
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  'web-form': 'Web Form',
  phone: 'Phone',
  sms: 'SMS',
  referral: 'Referral',
  google: 'Google',
  review: 'Review',
};

// ---------------------------------------------------------------------------
// Timeline item helpers
// ---------------------------------------------------------------------------
function ChannelIcon({ channel }: { channel: Communication['channel'] }) {
  const cls = 'h-4 w-4';
  switch (channel) {
    case 'sms':
      return <MessageSquare className={cls} />;
    case 'call':
      return <Phone className={cls} />;
    case 'email':
      return <Mail className={cls} />;
    case 'note':
    default:
      return <StickyNote className={cls} />;
  }
}

const CHANNEL_COLOR: Record<Communication['channel'], string> = {
  sms: 'bg-blue-50 text-blue-600 border-blue-200',
  call: 'bg-green-50 text-green-600 border-green-200',
  email: 'bg-purple-50 text-purple-600 border-purple-200',
  note: 'bg-amber-50 text-amber-600 border-amber-200',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [noteText, setNoteText] = useState('');
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [intakeSummary, setIntakeSummary] = useState<IntakeSummary | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const { data: lead, isLoading: leadLoading, isError: leadError } = useLead(id ?? '');
  const { data: comms, isLoading: commsLoading } = useLeadCommunications(id ?? '');
  const { data: currentUser } = useCurrentUser();

  const updateLead = useUpdateLead();
  const addNote = useAddNote();
  const { data: partners } = usePartners({ active: true });

  const handleStatusChange = (status: LeadStatus) => {
    if (!lead) return;
    updateLead.mutate({ id: lead.id, data: { status } });
  };

  const handleAddNote = async () => {
    if (!lead || !noteText.trim() || !currentUser) return;
    await addNote.mutateAsync({
      lead_id: lead.id,
      firm_id: currentUser.firm_id,
      message: noteText.trim(),
    });
    setNoteText('');
  };

  async function handleIntakeSummary() {
    if (!lead?.notes?.trim()) return;
    setIntakeLoading(true);
    setIntakeError(null);
    try {
      const result = await apiPost<IntakeSummary>('/ai/intake-summary', {
        notes: lead.notes,
        lead_id: lead.id,
      });
      setIntakeSummary(result);
    } catch (e) {
      setIntakeError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIntakeLoading(false);
    }
  }

  // Reverse-chronological timeline
  const timeline = comms ? [...comms].reverse() : [];

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------
  if (leadLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading lead…</span>
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 font-medium">Lead not found.</p>
        <Link to="/leads">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leads
          </Button>
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link to="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Leads
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="text-sm text-gray-500">
            Created{' '}
            {relativeTime(lead.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.lead_score !== null && (
            <span
              title={lead.lead_score_reason ?? undefined}
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-help',
                lead.lead_score >= 70 ? 'bg-green-100 text-green-800' :
                lead.lead_score >= 40 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-700',
              ].join(' ')}
            >
              Score: {lead.lead_score}
            </span>
          )}
          <span
            className={[
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
              STATUS_BADGE[lead.status],
            ].join(' ')}
          >
            {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label ?? lead.status}
          </span>
          {lead.status === 'signed' && (
            <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setCaseDialogOpen(true)}>
                  <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                  Convert to Case
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg" onClose={() => setCaseDialogOpen(false)}>
                <DialogHeader>
                  <DialogTitle>Create Case from Lead</DialogTitle>
                </DialogHeader>
                <CaseCreateForm
                  leadId={lead.id}
                  defaultValues={{
                    first_name: lead.first_name,
                    last_name: lead.last_name,
                    phone: lead.phone,
                    email: lead.email,
                    case_type: lead.injury_type as never,
                  }}
                  onSuccess={(caseId) => {
                    setCaseDialogOpen(false);
                    navigate(`/cases/${caseId}`);
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ------------------------------------------------------------------ */}
        {/* LEFT: 2/3 */}
        {/* ------------------------------------------------------------------ */}
        <div className="lg:col-span-2 space-y-5">
          {/* Duplicate warning */}
          {lead.is_duplicate && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Possible Duplicate</span>
              <span>—</span>
              <span>This lead may match an existing record.</span>
              {lead.duplicate_of_lead_id && (
                <Link
                  to={`/leads/${lead.duplicate_of_lead_id}`}
                  className="ml-auto text-amber-700 underline hover:text-amber-900 whitespace-nowrap"
                >
                  View original lead
                </Link>
              )}
            </div>
          )}

          {/* Lead info card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Name</p>
                <p className="font-medium text-gray-900">
                  {lead.first_name} {lead.last_name}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Phone</p>
                <p className="font-medium text-gray-900">{lead.phone}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Email</p>
                <p className="font-medium text-gray-900">
                  {lead.email || <span className="text-gray-400 italic">—</span>}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                  Injury Type
                </p>
                <p className="font-medium text-gray-900">
                  {INJURY_LABEL[lead.injury_type] ?? lead.injury_type}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Source</p>
                <Badge variant="outline" className="text-xs">
                  {SOURCE_LABEL[lead.source] ?? lead.source}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Created</p>
                <p className="font-medium text-gray-900">
                  {new Date(lead.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {lead.notes && (
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
                    Intake Notes
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
              {lead.notes && (
                <div className="col-span-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleIntakeSummary}
                    disabled={intakeLoading}
                    className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                  >
                    {intakeLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {intakeSummary ? 'Re-analyze Notes' : 'AI Intake Summary'}
                  </Button>
                  {intakeError && (
                    <p className="text-xs text-red-500 mt-2">{intakeError}</p>
                  )}
                  {intakeSummary && (
                    <div className="mt-3 bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-purple-700 font-medium">
                        <Brain className="w-3.5 h-3.5" />
                        AI Intake Analysis
                      </div>
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[10px] font-medium">Injury</span>
                        <p className="text-gray-800 mt-0.5">{intakeSummary.injury_description}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[10px] font-medium">Liability</span>
                        <p className="text-gray-800 mt-0.5">{intakeSummary.liability_assessment}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 uppercase tracking-wide text-[10px] font-medium">Next Steps</span>
                        <ul className="list-disc ml-3 mt-0.5 text-gray-800 space-y-0.5">
                          {intakeSummary.next_steps.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <span className="text-gray-500">Case type: <span className="font-medium text-gray-800">{intakeSummary.case_type}</span></span>
                        <span className={[
                          'rounded-full px-2 py-0.5 font-medium',
                          intakeSummary.urgency === 'high' ? 'bg-red-100 text-red-700' :
                          intakeSummary.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600',
                        ].join(' ')}>
                          {intakeSummary.urgency} urgency
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status change */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Status</CardTitle>
              <CardDescription>Move this lead through the pipeline</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Select
                value={lead.status}
                onValueChange={(val) => handleStatusChange(val as LeadStatus)}
                disabled={updateLead.isPending}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updateLead.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
              {updateLead.isSuccess && (
                <span className="text-xs text-green-600">Status updated</span>
              )}
              {updateLead.isError && (
                <span className="text-xs text-red-500">Update failed</span>
              )}
            </CardContent>
          </Card>

          {/* Referred by */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-base">Referred By</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Select
                value={lead.referred_by_partner_id ?? 'none'}
                onValueChange={(v) => {
                  updateLead.mutate({
                    id: lead.id,
                    data: { referred_by_partner_id: v === 'none' ? null : v },
                  });
                }}
                disabled={updateLead.isPending}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="No referral source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No referral source</SelectItem>
                  {(partners ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lead.referred_by_partner_id && (
                <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                  <Handshake className="w-3 h-3" />
                  Referral tracked
                </p>
              )}
            </CardContent>
          </Card>

          {/* Add note */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="note-input" className="sr-only">
                  Note
                </Label>
                <Textarea
                  id="note-input"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add an internal note about this lead…"
                  rows={3}
                  disabled={addNote.isPending}
                />
              </div>
              {addNote.isError && (
                <p className="text-xs text-red-500">
                  {addNote.error?.message ?? 'Failed to add note.'}
                </p>
              )}
              <Button
                onClick={handleAddNote}
                disabled={!noteText.trim() || addNote.isPending || !currentUser}
                size="sm"
              >
                {addNote.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Add Note'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT: 1/3 — Timeline */}
        {/* ------------------------------------------------------------------ */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <CardDescription>All communications for this lead</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {commsLoading && (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading timeline…
                </div>
              )}

              {!commsLoading && timeline.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No activity yet.
                </p>
              )}

              {!commsLoading &&
                timeline.map((comm) => (
                  <div
                    key={comm.id}
                    className="flex gap-3 text-sm"
                  >
                    {/* Channel icon badge */}
                    <div
                      className={[
                        'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full border',
                        CHANNEL_COLOR[comm.channel],
                      ].join(' ')}
                    >
                      <ChannelIcon channel={comm.channel} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium capitalize text-gray-700">
                          {comm.channel}
                        </span>
                        {comm.direction === 'outbound' && (
                          <ArrowUpRight className="h-3 w-3 text-gray-400" aria-label="outbound" />
                        )}
                        {comm.direction === 'inbound' && (
                          <ArrowDownLeft className="h-3 w-3 text-gray-400" aria-label="inbound" />
                        )}
                        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                          {relativeTime(comm.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs line-clamp-3 break-words">
                        {comm.message}
                      </p>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audit log */}
      {lead && <AuditLogPanel entityType="lead" entityId={lead.id} />}
    </div>
  );
}
