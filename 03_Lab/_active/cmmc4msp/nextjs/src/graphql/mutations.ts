import { gql } from '@apollo/client'

export const UPDATE_CONTROL_STATUS = gql`
  mutation UpdateControlStatus($id: uuid!, $status: String!, $notes: String) {
    update_program_controls_by_pk(
      pk_columns: { id: $id }
      _set: { status: $status, implementation_notes: $notes }
    ) {
      id
      status
      implementation_notes
    }
  }
`

export const UPDATE_CONTROL_NOTES = gql`
  mutation UpdateControlNotes($id: uuid!, $notes: String!) {
    update_program_controls_by_pk(
      pk_columns: { id: $id }
      _set: { implementation_notes: $notes }
    ) {
      id
      implementation_notes
    }
  }
`

export const UPDATE_ASSIGNMENT = gql`
  mutation UpdateAssignment($id: uuid!, $status: String!) {
    update_assignments_by_pk(pk_columns: { id: $id }, _set: { status: $status }) {
      id
      status
    }
  }
`

export const CREATE_ASSIGNMENT = gql`
  mutation CreateAssignment($object: assignments_insert_input!) {
    insert_assignments_one(object: $object) {
      id
      status
      assigned_to
      due_date
      instructions
      program_control_id
      program_id
    }
  }
`

export const UPDATE_MILESTONE = gql`
  mutation UpdateMilestone(
    $id: uuid!
    $milestone_date: date
    $responsible_org: String
    $remediation_plan: String
  ) {
    update_milestones_by_pk(
      pk_columns: { id: $id }
      _set: {
        current_milestone_date: $milestone_date
        responsible_org: $responsible_org
        remediation_plan: $remediation_plan
      }
    ) {
      id
      current_milestone_date
      responsible_org
      remediation_plan
      is_complete
    }
  }
`
