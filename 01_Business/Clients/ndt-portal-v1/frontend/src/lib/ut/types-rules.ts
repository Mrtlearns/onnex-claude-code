/**
 * Types for the UT Rule Engine — rule sets, versions, traces, and API responses.
 */

import type { GeometryType, InspectionClass, UtScanResult, UtWeightResult, UtLotResult } from './types';

// ── Rule Set Types ───────────────────────────────────────────────

export interface RuleSet {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  latest_version: number;
}

export interface RuleSetVersion {
  id: string;
  version: number;
  is_latest: boolean;
  notes: string | null;
  created_at: string;
  created_by: string;
}

export interface RuleSetDetail extends RuleSet {
  versions: RuleSetVersion[];
}

export interface RuleDefinition {
  type: 'lookup' | 'formula' | 'function';
  [key: string]: unknown;
}

export interface Rule {
  id: string;
  category: string;
  geometry_type: string | null;
  sort_order: number;
  label: string;
  description: string | null;
  definition: RuleDefinition;
}

export interface VersionWithRules extends RuleSetVersion {
  rule_set_id: string;
  rule_set_name: string;
  rules: Rule[];
}

// ── Available Versions (for dropdown) ────────────────────────────

export interface AvailableVersions {
  ruleSetName: string;
  ruleSetId: string;
  selectedVersionId: string | null;
  versions: RuleSetVersion[];
}

// ── Trace Types ──────────────────────────────────────────────────

export interface TraceStep {
  stepIndex: number;
  ruleName: string;
  ruleCategory: string;
  expression: string;
  namedInputs: Record<string, number | string | boolean | null>;
  result: number;
}

export interface CalculationTrace {
  ruleSetName: string;
  ruleSetVersion: number;
  ruleSetVersionId: string;
  geometryType: string;
  inputs: Record<string, unknown>;
  steps: TraceStep[];
  scanResult: Record<string, number>;
  weightResult: Record<string, number> | null;
  lotResult: Record<string, number>;
  finalResult: { pricePart: number; grandTotal: number };
}

export interface TraceSummary {
  id: string;
  quote_id: string | null;
  rule_set_name: string;
  rule_set_version: number;
  geometry_type: string;
  final_result: { pricePart: number; grandTotal: number };
  calculated_at: string;
  calculated_by: string;
}

// ── Calculate API Types ──────────────────────────────────────────

export interface CalculateRequest {
  customerId: string;
  geometryType: GeometryType;
  dims: {
    thickness: number;
    width: number;
    length: number;
    diameter: number;
    od: number;
    id_: number;
    numScans: number;
  };
  scanIndex: number;
  quantity: number;
  ruleSetVersionId?: string;
  useWeightPricing?: boolean;
  materialId?: string;
  inspectionClass?: InspectionClass;
  persistTrace?: boolean;
}

export interface CalculateResponse {
  scanResult: UtScanResult;
  weightResult: UtWeightResult | null;
  lotResult: UtLotResult;
  ruleSetName: string;
  ruleSetVersion: number;
  ruleSetVersionId: string;
  traceId?: string;
  trace: CalculationTrace;
}

// ── Version Diff Types ───────────────────────────────────────────

export interface VersionDiff {
  added: Rule[];
  removed: Rule[];
  changed: Array<{
    key: string;
    label: string;
    v1: unknown;
    v2: unknown;
  }>;
}

// ── Publish Types ────────────────────────────────────────────────

export interface PublishRuleInput {
  category: string;
  geometryType: string | null;
  sortOrder: number;
  label: string;
  description?: string;
  definition: Record<string, unknown>;
}

export interface PublishVersionRequest {
  notes?: string;
  rules: PublishRuleInput[];
}
