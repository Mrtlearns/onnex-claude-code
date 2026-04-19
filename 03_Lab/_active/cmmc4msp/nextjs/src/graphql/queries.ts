import { gql } from '@apollo/client'

export const GET_ORGS = gql`
  query GetOrgs {
    orgs(order_by: { name: asc }) {
      id
      name
      slug
      status
      created_at
      programs(limit: 1, order_by: { created_at: desc }) {
        id
        sprs_score
        far_above_score
        current_phase
        status
      }
    }
  }
`

export const GET_ORG_BY_SLUG = gql`
  query GetOrgBySlug($slug: String!) {
    orgs(where: { slug: { _eq: $slug } }) {
      id
      name
      slug
      status
      cage_code
      primary_contact_name
      primary_contact_email
      created_at
      programs(order_by: { created_at: desc }) {
        id
        name
        sprs_score
        far_above_score
        current_phase
        status
        system_name
        created_at
      }
    }
  }
`

export const GET_PROGRAM_DASHBOARD = gql`
  query GetProgramDashboard($programId: uuid!) {
    programs_by_pk(id: $programId) {
      id
      name
      sprs_score
      far_above_score
      current_phase
      status
      system_name
    }
    program_controls_aggregate(where: { program_id: { _eq: $programId } }) {
      aggregate {
        count
      }
    }
    fully_implemented: program_controls_aggregate(
      where: {
        program_id: { _eq: $programId }
        status: { _eq: "fully_implemented" }
        is_applicable: { _eq: true }
      }
    ) {
      aggregate {
        count
      }
    }
    not_addressed: program_controls_aggregate(
      where: {
        program_id: { _eq: $programId }
        status: { _eq: "not_yet_addressed" }
        is_applicable: { _eq: true }
      }
    ) {
      aggregate {
        count
      }
    }
    in_progress: program_controls_aggregate(
      where: {
        program_id: { _eq: $programId }
        status: { _in: ["implementation_planned", "implementation_begun"] }
        is_applicable: { _eq: true }
      }
    ) {
      aggregate {
        count
      }
    }
    program_controls(where: { program_id: { _eq: $programId } }) {
      id
      status
      is_applicable
      is_phase_unlocked
      score_impact
      control_definition {
        id
        nist_id
        cmmc_id
        family
        family_abbrev
        far_above_phase
        dod_score_value
      }
    }
  }
`

export const GET_PROGRAM_CONTROLS = gql`
  query GetProgramControls($programId: uuid!, $phase: String, $status: String) {
    program_controls(
      where: {
        program_id: { _eq: $programId }
        _and: [
          { control_definition: { far_above_phase: { _eq: $phase } } }
          { status: { _eq: $status } }
        ]
      }
      order_by: { control_definition: { nist_id: asc } }
    ) {
      id
      status
      is_phase_unlocked
      is_applicable
      score_impact
      control_definition {
        id
        nist_id
        cmmc_id
        family
        family_abbrev
        far_above_phase
        dod_score_value
        requirement_text
      }
    }
  }
`

export const GET_PROGRAM_CONTROLS_UNFILTERED = gql`
  query GetProgramControlsUnfiltered($programId: uuid!) {
    program_controls(
      where: {
        program_id: { _eq: $programId }
        control_definition: { is_objective: { _eq: false } }
      }
      order_by: { control_definition: { nist_sort_order: asc } }
    ) {
      id
      status
      is_phase_unlocked
      is_applicable
      score_impact
      control_definition {
        id
        nist_id
        cmmc_id
        family
        family_abbrev
        far_above_phase
        dod_score_value
        requirement_text
      }
    }
  }
`

export const GET_CONTROL_DETAIL = gql`
  query GetControlDetail($controlId: uuid!) {
    program_controls_by_pk(id: $controlId) {
      id
      program_id
      status
      is_applicable
      is_phase_unlocked
      implementation_notes
      score_impact
      target_completion_date
      created_at
      control_definition {
        id
        nist_id
        cmmc_id
        family
        family_abbrev
        far_above_phase
        dod_score_value
        requirement_text
        assessment_objective
        acceptable_proof_guidance
        is_objective
        is_basic
      }
      artifacts(order_by: { created_at: desc }) {
        id
        file_name
        mime_type
        assessment_status
        assessment_attempts
        created_at
        assessments(order_by: { created_at: desc }, limit: 1) {
          id
          verdict
          confidence
          rationale
          gaps
          model_used
          reviewer_override
          reviewer_notes
          created_at
        }
      }
      assignments(order_by: { created_at: desc }) {
        id
        status
        due_date
        instructions
        assigned_to
        user {
          id
          email
          full_name
        }
      }
    }
  }
`

export const GET_MY_ASSIGNMENTS = gql`
  query GetMyAssignments($userId: uuid!) {
    assignments(
      where: { assigned_to: { _eq: $userId } }
      order_by: { due_date: asc_nulls_last }
    ) {
      id
      status
      due_date
      instructions
      program_id
      program_control {
        id
        status
        control_definition {
          id
          nist_id
          cmmc_id
          family
          family_abbrev
          requirement_text
          far_above_phase
        }
      }
    }
  }
`

export const GET_POAM_ITEMS = gql`
  query GetPoamItems($programId: uuid!) {
    program_controls(
      where: {
        program_id: { _eq: $programId }
        status: { _nin: ["fully_implemented", "not_applicable"] }
        is_applicable: { _eq: true }
      }
      order_by: { control_definition: { nist_id: asc } }
    ) {
      id
      status
      score_impact
      target_completion_date
      implementation_notes
      control_definition {
        id
        nist_id
        cmmc_id
        family
        family_abbrev
        requirement_text
        dod_score_value
        far_above_phase
      }
      milestones {
        id
        responsible_org
        resource_estimate
        remediation_plan
        current_milestone_date
        is_complete
      }
    }
  }
`

export const GET_ADMIN_ORGS = gql`
  query GetAdminOrgs {
    orgs(order_by: { name: asc }) {
      id
      name
      slug
      status
      created_at
      msp {
        id
        name
      }
      programs(limit: 1, order_by: { created_at: desc }) {
        id
        name
        sprs_score
        current_phase
        status
      }
    }
  }
`

export const GET_ADMIN_USERS = gql`
  query GetAdminUsers {
    users(order_by: { email: asc }) {
      id
      email
      full_name
      role
      is_active
      created_at
      org {
        id
        name
        slug
      }
      msp {
        id
        name
      }
    }
  }
`

export const GET_ADMIN_MSPS = gql`
  query GetAdminMsps {
    msps(order_by: { name: asc }) {
      id
      name
      slug
      status
      created_at
      orgs_aggregate {
        aggregate {
          count
        }
      }
      users_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`

export const GET_RECENT_ERRORS = gql`
  query GetRecentErrors($limit: Int!) {
    error_events(
      where: { triaged: { _eq: false } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      id
      source
      component
      severity
      message
      created_at
      correlation_id
      org_id
    }
  }
`

export const GET_PROGRAM_ARTIFACTS = gql`
  query GetProgramArtifacts($programId: uuid!) {
    artifacts(
      where: { program_control: { program_id: { _eq: $programId } } }
      order_by: { created_at: desc }
    ) {
      id
      file_name
      mime_type
      assessment_status
      assessment_attempts
      created_at
      program_control {
        id
        control_definition {
          id
          nist_id
          cmmc_id
          family_abbrev
          requirement_text
        }
      }
      assessments(order_by: { created_at: desc }, limit: 1) {
        id
        verdict
        confidence
        rationale
        created_at
      }
    }
  }
`

export const GET_LATEST_TRIAGE_REPORT = gql`
  query GetLatestTriageReport {
    triage_reports(order_by: { created_at: desc }, limit: 1) {
      id
      status
      event_count
      report
      error_message
      created_at
      completed_at
    }
  }
`
