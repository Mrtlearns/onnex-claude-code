export type OrgStatus = 'active' | 'inactive' | 'suspended'
export type UserRole = 'msp_admin' | 'client_admin' | 'contributor' | 'viewer'
export type ProgramStatus = 'scoping' | 'in_progress' | 'assessment_ready' | 'certified'
export type ControlStatus =
  | 'not_yet_assessed'
  | 'not_yet_addressed'
  | 'implementation_planned'
  | 'implementation_begun'
  | 'fully_implemented'
  | 'not_applicable'
export type AssignmentStatus =
  | 'unassigned'
  | 'assigned'
  | 'submitted'
  | 'in_review'
  | 'accepted'
  | 'rejected'
export type ArtifactStatus = 'pending' | 'processing' | 'assessed' | 'failed'
export type AssessmentVerdict = 'pass' | 'partial' | 'fail' | 'not_applicable'

export interface Org {
  id: string
  name: string
  slug: string
  status: OrgStatus
  cage_code?: string
  primary_contact_name?: string
  primary_contact_email?: string
  created_at: string
  programs?: Program[]
}

export interface Program {
  id: string
  org_id: string
  name: string
  status: ProgramStatus
  system_name?: string
  sprs_score: number | null
  far_above_score: number
  current_phase: string
  cmmc_level: 2 | 3
  show_l3_preview: boolean
  readiness_pct: number | null
  created_at: string
  org?: Org
}

export interface ControlDefinition {
  id: string
  nist_id: string
  cmmc_id: string
  family: string
  family_abbrev: string
  far_above_phase: string
  dod_score_value?: number
  requirement_text: string
  assessment_objective?: string
  acceptable_proof_guidance?: string
  is_objective: boolean
  is_basic: boolean
}

export interface ProgramControl {
  id: string
  program_id: string
  control_definition_id: string
  status: ControlStatus
  is_applicable: boolean
  is_phase_unlocked: boolean
  implementation_notes?: string
  score_impact: number
  target_completion_date?: string
  created_at: string
  control_definition?: ControlDefinition
  artifacts?: Artifact[]
  assignments?: Assignment[]
}

export interface Assignment {
  id: string
  program_control_id: string
  program_id: string
  assigned_to?: string
  assigned_by?: string
  status: AssignmentStatus
  due_date?: string
  instructions?: string
  user?: { id: string; email: string; full_name?: string }
}

export interface Artifact {
  id: string
  program_control_id: string
  file_name: string
  mime_type?: string
  assessment_status: ArtifactStatus
  assessment_attempts: number
  created_at: string
  assessments?: Assessment[]
}

export interface Assessment {
  id: string
  artifact_id: string
  verdict: AssessmentVerdict
  confidence?: number
  rationale?: string
  gaps?: string[]
  model_used?: string
  reviewer_override: boolean
  reviewer_notes?: string
  created_at: string
}

export interface Milestone {
  id: string
  program_control_id: string
  program_id: string
  responsible_org?: string
  resource_estimate?: string
  remediation_plan?: string
  current_milestone_date?: string
  is_complete: boolean
}
