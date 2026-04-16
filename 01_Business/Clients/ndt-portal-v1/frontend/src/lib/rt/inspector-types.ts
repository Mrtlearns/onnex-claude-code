// ── Stage 1: PartClassification ───────────────────────────────────────────────

export interface DimensionValue {
  value: number;
  unit:  'in' | 'mm' | 'ft' | 'm';
}

export interface GeometryPrimitive {
  id:         string;
  type:       string;
  dimensions: {
    od?:       number;
    id?:       number;
    length?:   number;
    thickness?:number;
    angle?:    number;
    radius?:   number;
    width?:    number;
    height?:   number;
    depth?:    number;
    unit?:     string;
  };
  position?: {
    x: number;
    y: number;
    z: number;
    rotation_deg?: { rx: number; ry: number; rz: number };
  };
  material: string;
}

export interface InspectableFeature {
  id:                   string;
  type:                 string;
  connects?:            string[];
  weld_type?:           string;
  location_description?:string;
  position?: NormalizedPosition;
}

export interface NormalizedPosition {
  x_normalized:  number;
  y_normalized:  number;
  z_normalized:  number;
  angle_degrees?: number;
  span_degrees?:  number;
}

export interface PartMaterial {
  spec:                    string;
  form:                    string;
  applied_to?:             string[];
  metallurgical_concerns?: string[];
}

export interface PartClassification {
  part_id:          string;
  part_type:        PartType;
  part_description: string;
  applicable_codes: {
    primary:       string;
    supplementary?: string[];
  };
  geometry: {
    bounding_box?: {
      length: DimensionValue;
      width:  DimensionValue;
      height: DimensionValue;
    };
    primitives: GeometryPrimitive[];
  };
  features?:  InspectableFeature[];
  materials?: PartMaterial[];
  design_conditions?: {
    pressure?:             DimensionValue;
    temperature?:          DimensionValue;
    service?:              string;
    pwht_required?:        boolean;
    impact_test_required?: boolean;
    additional_notes?:     string;
  };
  rt_requirements_from_drawing?: {
    stated_rt_extent?:    string;
    acceptance_standard?: string;
  };
  analysis_module: AnalysisModule;
  confidence:      number;
}

export type PartType =
  | 'pressure_vessel'
  | 'pipe_spool'
  | 'structural_weldment'
  | 'casting'
  | 'forging'
  | 'aerospace_component'
  | 'heat_exchanger'
  | 'storage_tank'
  | 'other';

export type AnalysisModule =
  | 'asme_viii_vessel'
  | 'asme_b31_piping'
  | 'aws_structural'
  | 'casting_radiography'
  | 'forging_inspection'
  | 'aerospace_ndt'
  | 'heat_exchanger'
  | 'api_tank'
  | 'generic_rt';

// ── Stage 2: RTAnalysis ───────────────────────────────────────────────────────

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type GeometryType  = 'ring' | 'line' | 'patch' | 'sphere' | 'arc';

export interface ThreeJSSpec {
  geometry: string;
  params:   number[];
  position: [number, number, number];
  rotation: [number, number, number];
  scale:    [number, number, number];
}

export interface RenderPrimitive {
  id:      string;
  three_js: ThreeJSSpec;
  material_appearance: {
    color:     string;
    opacity:   number;
    metalness: number;
  };
}

export interface ExpectedDefect {
  type:           string;
  probability:    'HIGH' | 'MEDIUM' | 'LOW';
  description:    string;
  code_reference: string;
  severity_grade?: string;
}

export interface RTTechnique {
  source:                       string;
  energy_range?:                string;
  technique:                    string;
  detector:                     string;
  iqi_type:                     string;
  iqi_placement:                string;
  sfd_inches?:                  number;
  geometric_unsharpness_limit?: string;
  notes?:                       string;
}

export interface InspectionZone {
  id:            string;
  type:          string;
  severity:      SeverityLevel;
  on_primitive:  string;
  geometry_type: GeometryType;
  position:      NormalizedPosition;
  code_classification: {
    category:            string;
    rt_requirement:      string;
    joint_efficiency?:   number;
    acceptance_standard: string;
  };
  expected_defects?: ExpectedDefect[];
  rt_technique:      RTTechnique;
  overlay_render?: {
    color:           string;
    opacity:         number;
    pulse_animation?: boolean;
    line_width?:     number;
  };
  tooltip_text: string;
}

export interface CriticalIntersection {
  id:             string;
  zone_a:         string;
  zone_b:         string;
  severity:       'CRITICAL';
  position:       NormalizedPosition;
  defect_risks?:  string[];
  shot_technique?: string;
  tooltip_text:   string;
}

export interface RTAnalysis {
  part_id:              string;
  part_type:            string;
  analysis_module_used: string;
  analysis_summary:     string;
  render_model: {
    primitives: RenderPrimitive[];
  };
  inspection_zones:       InspectionZone[];
  critical_intersections?: CriticalIntersection[];
  compliance_flags?: Array<{
    code_paragraph:  string;
    condition:       string;
    action_required: string;
    flag_type:       'mandatory' | 'advisory' | 'informational';
  }>;
  shot_plan?: {
    total_exposures:       number;
    source_recommendation: string;
    estimated_film_count:  number;
    coverage_strategy:     string;
    special_techniques?:   string[];
  };
}

// ── Job polling ───────────────────────────────────────────────────────────────

export type JobStatus =
  | 'pending'
  | 'classifying'
  | 'assembling'
  | 'analyzing'
  | 'validating'
  | 'complete'
  | 'failed';

export interface AnalysisJob {
  jobId:              string;
  status:             JobStatus;
  stage?:             string;
  fileName?:          string;
  llmRouting?:        string;
  lowConfidence?:     boolean;
  classification?:    PartClassification;
  analysis?:          RTAnalysis;
  complianceClass?:   string;
  complianceScore?:   number;
  complianceRouting?: string;
  complianceHits?:    Array<{ pattern: string; category: string; weight: number; match: string }>;
  error?:             string;
  createdAt?:         string;
  updatedAt?:         string;
}
