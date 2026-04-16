import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────────────────────

const DimensionValueSchema = z.object({
  value: z.number(),
  unit:  z.enum(['in', 'mm', 'ft', 'm']),
});

// LLMs sometimes return bare numbers instead of {value, unit} objects.
// Coerce plain numbers to {value: n, unit: 'mm'} so bounding_box validation never fails.
const CoercedDimensionSchema = z.preprocess(
  (v) => (typeof v === 'number' ? { value: v, unit: 'mm' } : v),
  DimensionValueSchema,
);

const PressureValueSchema = z.object({
  value: z.number(),
  unit:  z.enum(['psi', 'bar', 'MPa', 'kPa']),
});

const TemperatureValueSchema = z.object({
  value: z.number(),
  unit:  z.enum(['F', 'C', 'K']),
});

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rotation_deg: z.object({
    rx: z.number(),
    ry: z.number(),
    rz: z.number(),
  }).optional(),
});

const NormalizedPositionSchema = z.object({
  x_normalized:  z.number().min(0).max(1),
  y_normalized:  z.number().min(0).max(1),
  z_normalized:  z.number().min(0).max(1),
  angle_degrees: z.number().min(0).max(360).optional().default(0),
  span_degrees:  z.number().min(0).max(360).optional().default(360),
});

// ── Stage 1: PartClassification ───────────────────────────────────────────────

export const PART_TYPES = [
  'pressure_vessel',
  'pipe_spool',
  'structural_weldment',
  'casting',
  'forging',
  'aerospace_component',
  'heat_exchanger',
  'storage_tank',
  'other',
] as const;

export const ANALYSIS_MODULES = [
  'asme_viii_vessel',
  'asme_b31_piping',
  'aws_structural',
  'casting_radiography',
  'forging_inspection',
  'aerospace_ndt',
  'heat_exchanger',
  'api_tank',
  'generic_rt',
] as const;

const GeometryPrimitiveSchema = z.object({
  id:         z.string().min(1),
  type:       z.string().min(1),
  dimensions: z.object({
    od:        z.number().optional(),
    id:        z.number().optional(),
    length:    z.number().optional(),
    thickness: z.number().optional(),
    angle:     z.number().optional(),
    radius:    z.number().optional(),
    width:     z.number().optional(),
    height:    z.number().optional(),
    depth:     z.number().optional(),
    unit:      z.string().optional(),
  }),
  position: PositionSchema.optional(),
  material: z.string(),
});

const InspectableFeatureSchema = z.object({
  id:                   z.string().min(1),
  type:                 z.string().min(1),
  connects:             z.array(z.string()).optional().default([]),
  weld_type:            z.string().optional(),
  location_description: z.string().optional(),
  position:             NormalizedPositionSchema.optional(),
});

const MaterialSchema = z.object({
  spec:                    z.string(),
  form:                    z.enum(['rolled_plate', 'forged', 'cast', 'extruded', 'wrought', 'other']),
  applied_to:              z.array(z.string()).optional().default([]),
  metallurgical_concerns:  z.array(z.string()).optional().default([]),
});

export const PartClassificationSchema = z.object({
  part_id:          z.string().min(1),
  part_type:        z.enum(PART_TYPES),
  part_description: z.string(),
  applicable_codes: z.object({
    primary:       z.string(),
    supplementary: z.array(z.string()).optional().default([]),
  }),
  geometry: z.object({
    bounding_box: z.object({
      length: CoercedDimensionSchema,
      width:  CoercedDimensionSchema,
      height: CoercedDimensionSchema,
    }).optional(),
    primitives: z.array(GeometryPrimitiveSchema).min(1),
  }),
  features:  z.array(InspectableFeatureSchema).optional().default([]),
  materials: z.array(MaterialSchema).optional().default([]),
  design_conditions: z.object({
    pressure:              PressureValueSchema.optional(),
    temperature:           TemperatureValueSchema.optional(),
    service:               z.string().optional(),
    pwht_required:         z.boolean().optional(),
    impact_test_required:  z.boolean().optional(),
    additional_notes:      z.string().optional(),
  }).optional(),
  rt_requirements_from_drawing: z.object({
    stated_rt_extent:    z.string().optional(),
    acceptance_standard: z.string().optional(),
  }).optional(),
  analysis_module: z.enum(ANALYSIS_MODULES),
  confidence:      z.number().min(0).max(1),
});

export type PartClassification = z.infer<typeof PartClassificationSchema>;

// ── Stage 2: RTAnalysis ───────────────────────────────────────────────────────

export const SEVERITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const GEOMETRY_TYPES   = ['ring', 'line', 'patch', 'sphere', 'arc'] as const;

const ThreeJSSpecSchema = z.object({
  geometry: z.string().min(1),
  params:   z.array(z.number()),
  position: z.array(z.number()).length(3),
  rotation: z.array(z.number()).length(3),
  scale:    z.array(z.number()).length(3),
});

const RenderPrimitiveSchema = z.object({
  id:      z.string().min(1),
  three_js: ThreeJSSpecSchema,
  material_appearance: z.object({
    color:     z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
    opacity:   z.number().min(0).max(1),
    metalness: z.number().min(0).max(1),
  }),
});

const ExpectedDefectSchema = z.object({
  type:           z.string(),
  probability:    z.enum(['HIGH', 'MEDIUM', 'LOW']),
  description:    z.string(),
  code_reference: z.string(),
  severity_grade: z.string().optional(),
});

const RTTechniqueSchema = z.object({
  source:                      z.string(),
  energy_range:                z.string().optional(),
  technique:                   z.string(),
  detector:                    z.string(),
  iqi_type:                    z.string(),
  iqi_placement:               z.string(),
  sfd_inches:                  z.number().optional(),
  geometric_unsharpness_limit: z.string().optional(),
  notes:                       z.string().optional(),
});

const InspectionZoneSchema = z.object({
  id:            z.string().min(1),
  type:          z.string(),
  severity:      z.enum(SEVERITY_LEVELS),
  on_primitive:  z.string(),
  geometry_type: z.enum(GEOMETRY_TYPES),
  position:      NormalizedPositionSchema,
  code_classification: z.object({
    category:           z.string(),
    rt_requirement:     z.string(),
    joint_efficiency:   z.number().min(0).max(1).optional(),
    acceptance_standard: z.string(),
  }),
  expected_defects: z.array(ExpectedDefectSchema).optional().default([]),
  rt_technique:     RTTechniqueSchema,
  overlay_render: z.object({
    color:           z.string(),
    opacity:         z.number().min(0).max(1),
    pulse_animation: z.boolean().optional().default(false),
    line_width:      z.number().optional(),
  }).optional(),
  tooltip_text: z.string(),
});

export const RTAnalysisSchema = z.object({
  part_id:              z.string(),
  part_type:            z.string(),
  analysis_module_used: z.string(),
  analysis_summary:     z.string(),
  render_model: z.object({
    primitives: z.array(RenderPrimitiveSchema).min(1),
  }),
  inspection_zones:     z.array(InspectionZoneSchema).min(1),
  critical_intersections: z.array(z.object({
    id:            z.string(),
    zone_a:        z.string(),
    zone_b:        z.string(),
    severity:      z.literal('CRITICAL'),
    position:      NormalizedPositionSchema,
    defect_risks:  z.array(z.string()).optional().default([]),
    shot_technique: z.string().optional(),
    tooltip_text:  z.string(),
  })).optional().default([]),
  compliance_flags: z.array(z.object({
    code_paragraph:  z.string(),
    condition:       z.string(),
    action_required: z.string(),
    flag_type:       z.enum(['mandatory', 'advisory', 'informational']),
  })).optional().default([]),
  shot_plan: z.object({
    total_exposures:       z.number().int().nonnegative(),
    source_recommendation: z.string(),
    estimated_film_count:  z.number().int().nonnegative(),
    coverage_strategy:     z.string(),
    special_techniques:    z.array(z.string()).optional().default([]),
  }).optional(),
});

export type RTAnalysis = z.infer<typeof RTAnalysisSchema>;

// ── Validation helpers ────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean;
  data?:   T;
  errors:  string[];
  warnings: string[];
}

export function validateClassification(raw: unknown): ValidationResult<PartClassification> {
  const result = PartClassificationSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors:  result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const data = result.data;

  if (data.confidence < 0.6) {
    warnings.push(`Low confidence: ${(data.confidence * 100).toFixed(0)}% — manual review recommended`);
  }
  if (data.geometry.primitives.length === 0) {
    warnings.push('No geometry primitives extracted — 3D model cannot be rendered');
  }

  return { success: true, data, errors: [], warnings };
}

export function validateAnalysis(
  raw: unknown,
  classification: PartClassification,
): ValidationResult<RTAnalysis> {
  const result = RTAnalysisSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors:  result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      warnings: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const data = result.data;

  // Validate all on_primitive IDs reference valid Stage 1 primitives
  const knownPrimitiveIds = new Set(classification.geometry.primitives.map(p => p.id));
  for (const zone of data.inspection_zones) {
    if (!knownPrimitiveIds.has(zone.on_primitive)) {
      errors.push(`Zone ${zone.id} references unknown primitive "${zone.on_primitive}"`);
    }
  }

  // Validate render_model primitive IDs match Stage 1
  for (const rp of data.render_model.primitives) {
    if (!knownPrimitiveIds.has(rp.id)) {
      warnings.push(`Render primitive "${rp.id}" not in Stage 1 classification — will still render`);
    }
  }

  // Check for at least one CRITICAL or HIGH zone
  const hasHighSeverity = data.inspection_zones.some(
    z => z.severity === 'CRITICAL' || z.severity === 'HIGH',
  );
  if (!hasHighSeverity) {
    warnings.push('No CRITICAL or HIGH severity zones identified — verify analysis completeness');
  }

  return { success: errors.length === 0, data: errors.length === 0 ? data : undefined, errors, warnings };
}
