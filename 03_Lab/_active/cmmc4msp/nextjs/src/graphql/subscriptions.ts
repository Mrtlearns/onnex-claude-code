import { gql } from '@apollo/client'

export const SUBSCRIBE_PROGRAM_DASHBOARD = gql`
  subscription SubscribeProgramDashboard($programId: uuid!) {
    programs_by_pk(id: $programId) {
      id
      sprs_score
      far_above_score
      current_phase
      status
      cmmc_level
      show_l3_preview
      readiness_pct
    }
  }
`

export const SUBSCRIBE_ACTIVITY_FEED = gql`
  subscription SubscribeActivityFeed($orgId: uuid!) {
    activity_log(
      where: { org_id: { _eq: $orgId } }
      order_by: { created_at: desc }
      limit: 20
    ) {
      id
      event_type
      description
      created_at
      user {
        id
        email
        full_name
      }
    }
  }
`
