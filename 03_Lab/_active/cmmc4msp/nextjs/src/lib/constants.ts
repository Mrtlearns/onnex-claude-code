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
  { phase: '1', label: 'Boundary & Physical', controls: 17, points: 37 },
  { phase: '2', label: 'SSP & Identity', controls: 23, points: 32 },
  { phase: '3', label: 'Remote Access & IR', controls: 22, points: 34 },
  { phase: '4', label: 'Audit & Config', controls: 23, points: 37 },
  { phase: '5', label: 'Advanced & Personnel', controls: 25, points: 47 },
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
