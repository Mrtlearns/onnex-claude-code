// ============================================================
// RT PLANNING API — INPUT / OUTPUT INTERFACES
// Two-stage LLM: geometry extraction → radiographic technique cards
// ============================================================

export interface RtPlanRequest {
  /** Raw text input: email body, notes, work order text, etc. */
  rawInput: string;
}

/** Stage 1 output: structural facts extracted from raw text */
export interface PartGeometry {
  partNumber?: string;
  customerName?: string;
  material?: string;
  sectionThicknesses: { location: string; thicknessMm: number }[];
  penetrationPaths: string[];
  criticalFeatures: string[];
  acceptanceStandard?: string;
  accessConstraints?: string;
}

/** Per-machine suitability assessment (Stage 2 output) */
export interface MachineSuitability {
  machineId: string;
  /** 0–100: envelope / weight fit headroom */
  fitScore: number;
  /** 0–100: kV range coverage + modality match */
  suitabilityScore: number;
  reasoning: string;
  disqualified: boolean;
  disqualifyReason?: string;
}

/**
 * One RT technique card — covers a single view / exposure setup.
 * Costing fields map 1:1 to RtViewRequest for auto pre-fill.
 */
export interface RtTechniqueCard {
  // Radiographic geometry
  viewNumber: number;
  /** Human-readable label, e.g. "Weld A — 0°" */
  location: string;
  penetratedThicknessMm: number;
  selectedMachineId: string;
  kV: number;
  mA?: number;
  sod_mm: number;
  odd_mm: number;
  sfd_mm: number;
  geometricUnsharpnessMm: number;
  magnificationFactor: number;
  filmClass: string;
  iqi_type: string;
  iqi_placement: 'source_side' | 'film_side';
  scatter_concern: 'low' | 'medium' | 'high';
  xray_wash_risk: 'low' | 'medium' | 'high';
  xray_wash_mitigation?: string;

  // Costing fields — maps directly to RtViewRequest
  /** Film size label, e.g. "7X17" */
  filmSizeLabel: string;
  /** 0=none, 1=single, 2=double, 3=triple */
  shotType: 0 | 1 | 2 | 3;
  /** LLM estimate, default 1 */
  qtyPartsPerFilm: number;
  /** Exposure time converted to minutes */
  shotTime: number;
  /** Minutes to unpack and load */
  unpackLoadTime: number;
  /** Minutes for darkroom sort */
  darkroomSortTime: number;
  /** Minutes to read and interpret */
  readTime: number;
}

/** Full planning result returned by POST /rt/plan */
export interface RtPlanningResult {
  extraction: PartGeometry;
  machineSuitability: MachineSuitability[];
  selectedMachineId: string;
  selectionRationale: string;
  techniqueCards: RtTechniqueCard[];
  imageQualitySummary: string;
  planningWarnings: string[];
  /** UUID of the persisted planning_sessions row */
  sessionId: string;
}
