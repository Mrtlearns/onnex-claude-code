/**
 * Persists calculation traces to the database for long-term audit/compliance.
 */

import { queryOne } from '../db';
import type { CalculationTrace } from './rule-engine';

/**
 * Persist a calculation trace and return the UUID.
 * The trace is stored in ut_rules.calculation_traces for years-long retention.
 */
export async function persistTrace(
  trace: CalculationTrace,
  quoteId?: string,
  calculatedBy?: string,
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO ut_rules.calculation_traces
       (quote_id, rule_set_name, rule_set_version, rule_set_version_id,
        geometry_type, inputs, steps, scan_result, weight_result,
        lot_result, final_result, calculated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      quoteId ?? null,
      trace.ruleSetName,
      trace.ruleSetVersion,
      trace.ruleSetVersionId,
      trace.geometryType,
      JSON.stringify(trace.inputs),
      JSON.stringify(trace.steps),
      JSON.stringify(trace.scanResult),
      trace.weightResult ? JSON.stringify(trace.weightResult) : null,
      JSON.stringify(trace.lotResult),
      JSON.stringify(trace.finalResult),
      calculatedBy ?? 'system',
    ],
  );

  return row!.id;
}
