export interface Firm {
  id: string;
  name: string;
  slug: string;
  phone: string;
  timezone: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'attorney' | 'paralegal';
  firm_id: string;
  firm_name: string;
  firm_slug: string;
}

export type InjuryType =
  | 'auto'
  | 'slip-fall'
  | 'dog-bite'
  | 'premises-liability'
  | 'other';

export type LeadSource =
  | 'web-form'
  | 'phone'
  | 'sms'
  | 'referral'
  | 'google'
  | 'review';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'intake-in-progress'
  | 'signed'
  | 'lost';

export interface Lead {
  id: string;
  firm_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  injury_type: InjuryType;
  source: LeadSource;
  status: LeadStatus;
  notes: string;
  reminder_count: number;
  assigned_to: string | null;
  referred_by_partner_id: string | null;
  last_contact_at: string | null;
  resurrection_sent_at: string | null;
  lead_score: number | null;
  lead_score_reason: string | null;
  is_duplicate: boolean;
  duplicate_of_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  lead_id: string;
  firm_id: string;
  channel: 'sms' | 'call' | 'email' | 'note';
  direction: 'inbound' | 'outbound' | null;
  message: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface KpiResponseTime {
  firm_id: string;
  total_leads: number;
  responded_leads: number;
  avg_response_minutes: number;
  within_2_min_count: number;
}

export interface KpiRecoveryRate {
  firm_id: string;
  missed_unrecovered: number;
  missed_recovered: number;
  total_missed_calls: number;
  recovery_rate_pct: number;
}

export interface KpiLeadsByStatus {
  firm_id: string;
  status: LeadStatus;
  count: number;
}

export interface KpiIntakeCompletion {
  firm_id: string;
  signed: number;
  started_intake: number;
  total_leads: number;
  completion_rate_pct: number;
}

// ---------------------------------------------------------------------------
// Case Management (Phase 2)
// ---------------------------------------------------------------------------

export type CaseStatus =
  | 'intake'
  | 'investigation'
  | 'demand'
  | 'negotiation'
  | 'settlement'
  | 'litigation'
  | 'closed';

export type CaseType =
  | 'auto'
  | 'slip-fall'
  | 'dog-bite'
  | 'premises-liability'
  | 'other';

export type MedicalRequestStatus =
  | 'not-requested'
  | 'requested'
  | 'received'
  | 'reviewed';

export type TaskStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';

export type TaskType =
  | 'sol'
  | 'hearing'
  | 'deposition'
  | 'demand'
  | 'response'
  | 'general';

export type DocType =
  | 'retainer'
  | 'medical'
  | 'pleading'
  | 'correspondence'
  | 'settlement'
  | 'other';

export type SolUrgency = 'critical' | 'urgent' | 'warning';

export interface Client {
  id: string;
  firm_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  injury_description: string | null;
  insurance_carrier: string | null;
  insurance_policy: string | null;
  insurance_adjuster: string | null;
  adjuster_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  firm_id: string;
  lead_id: string | null;
  client_id: string | null;
  case_number: string | null;
  case_type: CaseType;
  date_of_loss: string | null;
  sol_date: string | null;
  status: CaseStatus;
  description: string | null;
  assigned_attorney: string | null;
  attorney_fee_pct: number | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Embedded via PostgREST select
  client?: { first_name: string; last_name: string } | null;
}

export interface MedicalProvider {
  id: string;
  firm_id: string;
  case_id: string;
  name: string;
  provider_type: string;
  request_status: MedicalRequestStatus;
  requested_at: string | null;
  received_at: string | null;
  lien_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  firm_id: string;
  case_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  task_type: TaskType;
  assigned_to: string | null;
  created_by: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  firm_id: string;
  case_id: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  doc_type: DocType;
  uploaded_by: string | null;
  shared_with_client: boolean;
  created_at: string;
}

export interface KpiSolAlert {
  id: string;
  firm_id: string;
  case_number: string | null;
  case_type: CaseType;
  sol_date: string;
  status: CaseStatus;
  assigned_attorney: string | null;
  client_name: string | null;
  days_until_sol: number;
  urgency: SolUrgency;
}

export interface KpiTasksDue {
  id: string;
  firm_id: string;
  case_id: string | null;
  title: string;
  due_date: string;
  task_type: TaskType;
  status: TaskStatus;
  assigned_to: string | null;
  case_number: string | null;
  client_name: string | null;
  urgency: 'overdue' | 'due-today' | 'upcoming';
}

// ---------------------------------------------------------------------------
// Document AI (Phase 3)
// ---------------------------------------------------------------------------

export type AiAnalysisStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface MedicalAnalysis {
  provider_name: string;
  provider_type: string;
  dates_of_treatment: string[];
  diagnoses: string[];
  injuries_described: string;
  treatment_provided: string;
  total_bill: number;
  lien_amount: number;
  notes: string;
}

export interface AiClassification {
  document_type: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface AiAnalysis {
  id: string;
  document_id: string;
  status: AiAnalysisStatus;
  analysis: MedicalAnalysis | Record<string, unknown>;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandLetter {
  id: string;
  case_id: string;
  content: string;
  generated_at: string;
  updated_at: string;
}

export interface IntakeSummary {
  injury_description: string;
  liability_assessment: string;
  next_steps: string[];
  case_type: string;
  urgency: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Revenue Growth (Phase 4)
// ---------------------------------------------------------------------------

export type PartnerType = 'attorney' | 'medical' | 'chiropractor' | 'other';

export interface Partner {
  id: string;
  firm_id: string;
  name: string;
  partner_type: PartnerType;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerReferral {
  id: string;
  firm_id: string;
  partner_id: string;
  lead_id: string | null;
  case_id: string | null;
  commission_pct: number;
  commission_amount: number;
  commission_paid: boolean;
  referred_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePartnerInput {
  name: string;
  partner_type: PartnerType;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface CreateReferralInput {
  partner_id: string;
  lead_id?: string;
  case_id?: string;
  commission_pct?: number;
  commission_amount?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Billing + Finance (Phase 5)
// ---------------------------------------------------------------------------

export type OfferBy = 'defense' | 'plaintiff';

export type CostType =
  | 'medical_lien'
  | 'filing_fee'
  | 'expert_fee'
  | 'investigation'
  | 'other';

export interface SettlementOffer {
  id: string;
  firm_id: string;
  case_id: string;
  offer_by: OfferBy;
  amount: number;
  offered_at: string;
  notes: string | null;
  accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseCost {
  id: string;
  firm_id: string;
  case_id: string;
  cost_type: CostType;
  description: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  provider_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseSettlement {
  id: string;
  firm_id: string;
  case_id: string;
  gross_settlement: number;
  attorney_fee_pct: number;
  attorney_fee_amount: number; // GENERATED ALWAYS AS STORED — read-only
  costs_total: number;
  net_to_client: number;       // GENERATED ALWAYS AS STORED — read-only
  settled_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSettlementOfferInput {
  case_id: string;
  offer_by: OfferBy;
  amount: number;
  offered_at?: string;
  notes?: string;
  accepted?: boolean;
}

export interface CreateCaseCostInput {
  case_id: string;
  cost_type: CostType;
  description: string;
  amount: number;
  paid?: boolean;
  paid_at?: string;
  provider_id?: string;
}

export interface CreateCaseSettlementInput {
  case_id: string;
  gross_settlement: number;
  attorney_fee_pct?: number;
  costs_total?: number;
  settled_at?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Client Portal + Analytics (Phase 6)
// ---------------------------------------------------------------------------

export interface ClientUser {
  id: string;
  firm_id: string;
  client_id: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalSession {
  client_user_id: string;
  firm_id: string;
  client_id: string;
  case_id: string | null; // resolved after login
}

export interface CreateClientUserInput {
  client_id: string;
  email: string;
  password: string;
}

// Analytics view shapes
export interface AnalyticsCaseSummary {
  firm_id: string;
  total_cases: number;
  closed_cases: number;
  settled_cases: number;
  litigation_cases: number;
  avg_settlement: number;
  total_settlement_value: number;
  total_net_to_client: number;
  total_attorney_fees: number;
  settlement_rate_pct: number;
}

export interface AnalyticsLeadFunnel {
  firm_id: string;
  status: LeadStatus;
  count: number;
}

export interface AnalyticsReferralAttribution {
  firm_id: string;
  source: string;
  total_leads: number;
  signed_leads: number;
  lost_leads: number;
  conversion_pct: number;
}

export interface AnalyticsPartnerPerformance {
  firm_id: string;
  partner_id: string;
  name: string;
  partner_type: PartnerType;
  total_referrals: number;
  signed_referrals: number;
  conversion_pct: number;
  commissions_owed: number;
  commissions_paid: number;
}

export interface DashboardStats {
  response_time: KpiResponseTime | null;
  recovery_rate: KpiRecoveryRate | null;
  leads_by_status: KpiLeadsByStatus[];
  intake_completion: KpiIntakeCompletion | null;
}
