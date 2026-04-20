export const DOMAIN_ABBREVS: Record<string, string> = {
  AC: 'Access Control',
  AT: 'Awareness & Training',
  AU: 'Audit & Accountability',
  CM: 'Configuration Management',
  IA: 'Identification & Authentication',
  IR: 'Incident Response',
  MA: 'Maintenance',
  MP: 'Media Protection',
  PE: 'Physical Protection',
  PS: 'Personnel Security',
  RA: 'Risk Assessment',
  CA: 'Security Assessment',
  SC: 'System & Communications Protection',
  SI: 'System & Information Integrity',
}

export const PHASE_CONFIG = [
  {
    phase: '1', label: 'Boundary & Physical', controls: 17, points: 37,
    description: 'Establish your CUI boundary: physical access controls, network segmentation, and media protection. These 17 controls define who and what can reach your controlled environment.',
    unlocks: 'Phase 2 — SSP documentation and identity hardening',
  },
  {
    phase: '2', label: 'SSP & Identity', controls: 23, points: 32,
    description: 'Document your System Security Plan and lock down authentication. Control 3.12.4 (SSP) is the gate — SPRS is capped at -203 until it is marked complete.',
    unlocks: 'Phase 3 — Remote access and incident response',
  },
  {
    phase: '3', label: 'Remote Access & IR', controls: 22, points: 34,
    description: 'Secure all remote connections and establish incident response capability. Covers VPN/Zero Trust configurations, IR planning, and maintenance controls.',
    unlocks: 'Phase 4 — Audit trails and configuration management',
  },
  {
    phase: '4', label: 'Audit & Config', controls: 23, points: 37,
    description: 'Implement audit logging across all systems and lock down configurations. Every change must be tracked, every baseline enforced.',
    unlocks: 'Phase 5 — Risk management, personnel, and advanced security',
  },
  {
    phase: '5', label: 'Advanced & Personnel', controls: 25, points: 47,
    description: 'Complete risk assessments, supply chain controls, and personnel security. These 25 controls finalize your path to a 110 SPRS score and CMMC Level 2 readiness.',
    unlocks: 'CMMC Level 2 certification readiness',
  },
]

export function getSPRSColor(score: number): string {
  if (score < 0) return 'text-red-600'
  if (score < 70) return 'text-amber-500'
  return 'text-green-600'
}

export const CONTROL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_yet_assessed: { label: 'Not Assessed', color: 'bg-gray-100 text-gray-600' },
  not_yet_addressed: { label: 'Not Addressed', color: 'bg-red-100 text-red-700' },
  implementation_planned: { label: 'Planned', color: 'bg-yellow-100 text-yellow-700' },
  implementation_begun: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  fully_implemented: { label: 'Complete', color: 'bg-green-100 text-green-700' },
  not_applicable: { label: 'N/A', color: 'bg-gray-50 text-gray-400' },
}
