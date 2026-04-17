/**
 * NDT inspection type keyword detection — pure functions, no dependencies.
 *
 * Exported separately so the frontend test suite can import the real
 * implementation instead of maintaining a manually-mirrored copy.
 *
 * Import from frontend tests via the @ndtv1/api path alias:
 *   import { keywordDetectTypes } from '@ndtv1/api/lib/ndt-classify'
 */

export const INSPECTION_TYPES = ['RT', 'UT', 'ET', 'MT', 'PT', 'VT'] as const
export type InspectionType = typeof INSPECTION_TYPES[number]

/**
 * Detect NDT inspection types from email text using keyword patterns.
 * Always runs as a baseline — LLM results are merged on top, never replace.
 */
export function keywordDetectTypes(text: string): InspectionType[] {
  const lower = text.toLowerCase()
  const detected: InspectionType[] = []
  // RT: Radiographic Testing
  if (/\brt\b|radiograph|radiography|x.?ray|gamma.?ray|\bfilm\b|rad\s*test/.test(lower)) detected.push('RT')
  // UT: Ultrasonic Testing — \but\b catches standalone "UT"; ultrason\w+ catches ultrasonically etc.
  if (/\but\b|ultrason\w+|phased.?array|\btofd\b|shear.?wave|immersion\s*(test|scan)|c.?scan|\bcscan\b|thickness\s*(test|measur|check)/.test(lower)) detected.push('UT')
  // ET: Eddy Current Testing
  if (/\bet\b|eddy.?current|\bect\b/.test(lower)) detected.push('ET')
  // MT: Magnetic Particle Testing
  if (/\bmt\b|magnetic.?particle|mag.?particle|\bmpi\b|mag\s*test/.test(lower)) detected.push('MT')
  // PT: Penetrant Testing (Liquid / Fluorescent / Dye)
  if (/\bpt\b|penetrant|dye.?pen|\blpi\b|\bfpi\b|liquid\s*penetrant|fluorescent\s*penetrant/.test(lower)) detected.push('PT')
  // VT: Visual Testing
  if (/\bvt\b|visual\s*(test|inspect|examin)/.test(lower)) detected.push('VT')
  return detected
}

/**
 * Detect whether an email contains a part number or material specification.
 */
export function keywordDetectPartMaterial(text: string): boolean {
  const hasPartNumber = /p[\/#]?n[\s:.]+\S+|part\s*(no|number|#)[\s:.]+\S+|\bpn[\s:.]+\S+/i.test(text)
  const hasMaterial = /carbon\s*steel|stainless|alumin|inconel|titanium|duplex|copper|cast\s*iron/i.test(text)
  return hasPartNumber || hasMaterial
}
