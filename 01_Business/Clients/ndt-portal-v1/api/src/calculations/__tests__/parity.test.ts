/**
 * CRITICAL PARITY TESTS
 *
 * Verify that the rule engine produces IDENTICAL results to the old
 * hardcoded functions in api/src/calculations/ut.ts.
 *
 * If these tests fail, the rule engine seed data doesn't match the formulas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB for rule engine
vi.mock('../../db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import { query, queryOne } from '../../db';
import {
  computeScan as oldComputeScan,
  computeWeight as oldComputeWeight,
  computeLot as oldComputeLot,
  rateForGeometry as oldRateForGeometry,
  defaultLoadTime as oldDefaultLoadTime,
  type DbCustomer,
  type DbMaterial,
  type Dims as OldDims,
} from '../ut';
import { executeCalculation, type DbCustomerForRules, type DbMaterialForRules, type Dims } from '../rule-engine';
import type { GeometryType } from '../../types/quote';

// ── Test Data ────────────────────────────────────────────────────

const customer: DbCustomer = {
  id: 'cust-001', name: 'TEST CUSTOMER',
  hourly_rate: 225, cscan_rate: 250,
  technique_fee: 125, env_fee_rate: 0.02,
  min_charge: 225, cscan_min_charge: 250,
  delivery_fee: 'N/A', lead_time: '4-5 Days',
  has_env_fee: true, has_tech_fee: true,
  lot_pattern: 'min_enforced',
};

const customerForRules: DbCustomerForRules = {
  ...customer,
  rule_set_id: null,
  rule_version_pin: null,
};

const material: DbMaterial = {
  id: 'mat-001', name: 'Stainless steel',
  density_lb_per_cu_in: 0.290,
  class_a_rate_per_lb: 0.12,
  class_aa_rate_per_lb: 0.14,
};

const materialForRules: DbMaterialForRules = material;

const VERSION_ID = '00000000-0000-0000-0002-000000000001';
const SCAN_SPEED_DIVISOR = 10;

// Build the full mock rules set (same as seed migration)
function buildAllMockRules() {
  const scanFormulas: Record<string, Array<{ name: string; expr: string }>> = {
    FLAT_BAR: [
      { name: 'indexes', expr: '(dims.width + dims.thickness) / scanIndex' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'scanTimeFaceMin', expr: '0' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
    ],
    CSCAN_FLAT: [
      { name: 'indexes', expr: 'CEIL(dims.width / scanIndex)' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'scanTimeFaceMin', expr: '0' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
    ],
    THIN_SHEET: [
      { name: 'indexes', expr: 'CEIL(dims.width / scanIndex)' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'scanTimeFaceMin', expr: '0' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
    ],
    ROUND_BAR: [
      { name: 'circ', expr: 'PI * dims.diameter' },
      { name: 'indexes', expr: 'CEIL(circ / scanIndex)' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'scanTimeFaceMin', expr: '0' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
    ],
    CSCAN_ROUND: [
      { name: 'circ', expr: 'PI * dims.diameter' },
      { name: 'indexes', expr: 'CEIL(circ / scanIndex)' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'scanTimeFaceMin', expr: '0' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
    ],
    RING: [
      { name: 'wallThickness', expr: '(dims.od - dims.id_) / 2' },
      { name: 'circ', expr: 'PI * dims.od' },
      { name: 'indexes', expr: 'CEIL(circ / scanIndex)' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'faceIndexes', expr: 'CEIL(circ / scanIndex)' },
      { name: 'faceSecPerLine', expr: 'wallThickness / scanSpeedDivisor' },
      { name: 'scanTimeFaceMin', expr: '(faceIndexes * faceSecPerLine) / 60' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime + scanTimeFaceMin' },
    ],
    TUBING: [
      { name: 'circ', expr: 'PI * dims.diameter' },
      { name: 'indexes', expr: 'CEIL(circ / scanIndex)' },
      { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
      { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
      { name: 'scanTimeFaceMin', expr: '0' },
      { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
    ],
  };

  const rules: Array<{
    id: string;
    category: string;
    geometry_type: string | null;
    sort_order: number;
    label: string;
    definition: unknown;
  }> = [];

  // Scan formulas — one per geometry
  for (const [geo, steps] of Object.entries(scanFormulas)) {
    rules.push({
      id: `r-scan-${geo}`,
      category: 'scan_formula',
      geometry_type: geo,
      sort_order: rules.length,
      label: `${geo} scan formula`,
      definition: { type: 'formula', geometry: geo, steps },
    });
  }

  // Price modifiers
  rules.push({
    id: 'r-price-default',
    category: 'price_modifier',
    geometry_type: '*',
    sort_order: 0,
    label: 'Default price',
    definition: {
      type: 'formula', geometry: '*',
      steps: [{ name: 'pricePart', expr: 'ROUNDUP1((totalTimeMin / 60) * hourlyRate)' }],
    },
  });
  rules.push({
    id: 'r-price-thin',
    category: 'price_modifier',
    geometry_type: 'THIN_SHEET',
    sort_order: 1,
    label: 'Thin Sheet price',
    definition: {
      type: 'formula', geometry: 'THIN_SHEET',
      steps: [{ name: 'pricePart', expr: 'ROUNDUP1((totalTimeMin / 60) * hourlyRate * 2)' }],
    },
  });
  rules.push({
    id: 'r-price-tubing',
    category: 'price_modifier',
    geometry_type: 'TUBING',
    sort_order: 2,
    label: 'Tubing price',
    definition: {
      type: 'formula', geometry: 'TUBING',
      steps: [
        { name: 'pricePerScan', expr: 'ROUNDUP1((totalTimeMin / 60) * hourlyRate)' },
        { name: 'pricePart', expr: 'pricePerScan * dims.numScans' },
      ],
    },
  });

  // Weight formula
  rules.push({
    id: 'r-weight',
    category: 'weight_formula',
    geometry_type: null,
    sort_order: 0,
    label: 'Weight formula',
    definition: {
      type: 'formula',
      steps: [
        { name: 'cubicInches_flat', condition: 'geo_in_flat', expr: 'dims.thickness * dims.width * dims.length' },
        { name: 'cubicInches_round', condition: 'geo_in_round', expr: 'PI * POW(dims.diameter / 2, 2) * dims.length' },
        { name: 'cubicInches', expr: 'cubicInches_flat + cubicInches_round' },
        { name: 'weight', expr: 'cubicInches * material.density_lb_per_cu_in' },
        { name: 'rate', expr: "inspClass == 'AA' ? material.class_aa_rate_per_lb ?? material.class_a_rate_per_lb ?? 0 : material.class_a_rate_per_lb ?? 0" },
        { name: 'weightPrice', expr: 'ROUNDUP1(weight * rate)' },
      ],
      geometry_groups: {
        flat: ['FLAT_BAR', 'CSCAN_FLAT', 'THIN_SHEET'],
        round: ['ROUND_BAR', 'CSCAN_ROUND'],
      },
    },
  });

  // Lot calculation
  rules.push({
    id: 'r-lot',
    category: 'lot_calculation',
    geometry_type: null,
    sort_order: 0,
    label: 'Lot calc',
    definition: {
      type: 'formula',
      steps: [
        { name: 'extPrice', expr: 'ROUNDUP1(pricePart * qty)' },
        { name: 'minCharge', expr: 'isCScan ? customer.cscan_min_charge : customer.min_charge' },
        { name: 'lotCharge', expr: 'lotPattern_min_enforced ? MAX(extPrice, minCharge) : extPrice' },
        { name: 'techFee', expr: 'has_tech_fee ? customer.technique_fee : 0' },
        { name: 'subTotal', expr: 'lotCharge + techFee' },
        { name: 'envFee', expr: 'has_env_fee ? ROUNDUP1(subTotal * customer.env_fee_rate) : 0' },
        { name: 'grandTotal', expr: 'subTotal + envFee' },
      ],
    },
  });

  return rules;
}

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  const allRules = buildAllMockRules();
  (query as ReturnType<typeof vi.fn>).mockResolvedValue(allRules);
  (queryOne as ReturnType<typeof vi.fn>).mockResolvedValue({ version: 1, rs_name: 'default' });
});

// ── Parity Test Cases ────────────────────────────────────────────

interface TestCase {
  geo: GeometryType;
  dims: Dims;
  scanIndex: number;
  loadTime: number;
  hourlyRate: number;
  qty: number;
  isCScan: boolean;
}

const testCases: TestCase[] = [
  // FLAT_BAR - standard dimensions
  { geo: 'FLAT_BAR', dims: { thickness: 3.625, width: 11.625, length: 15.75, diameter: 0, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 3, hourlyRate: 225, qty: 1, isCScan: false },
  // FLAT_BAR - small part
  { geo: 'FLAT_BAR', dims: { thickness: 0.5, width: 2, length: 4, diameter: 0, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 3, hourlyRate: 225, qty: 5, isCScan: false },
  // ROUND_BAR
  { geo: 'ROUND_BAR', dims: { thickness: 0, width: 0, length: 12, diameter: 4, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 3, hourlyRate: 225, qty: 1, isCScan: false },
  // CSCAN_FLAT
  { geo: 'CSCAN_FLAT', dims: { thickness: 1, width: 8, length: 10, diameter: 0, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 3, hourlyRate: 250, qty: 2, isCScan: true },
  // CSCAN_ROUND
  { geo: 'CSCAN_ROUND', dims: { thickness: 0, width: 0, length: 8, diameter: 3, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 3, hourlyRate: 250, qty: 1, isCScan: true },
  // THIN_SHEET
  { geo: 'THIN_SHEET', dims: { thickness: 0.125, width: 24, length: 36, diameter: 0, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 3, hourlyRate: 225, qty: 1, isCScan: false },
  // RING
  { geo: 'RING', dims: { thickness: 0, width: 0, length: 6, diameter: 0, od: 10, id_: 6, numScans: 1 }, scanIndex: 0.065, loadTime: 5, hourlyRate: 225, qty: 1, isCScan: false },
  // TUBING - single scan
  { geo: 'TUBING', dims: { thickness: 0, width: 0, length: 12, diameter: 2, od: 0, id_: 0, numScans: 1 }, scanIndex: 0.065, loadTime: 2, hourlyRate: 250, qty: 1, isCScan: false },
  // TUBING - 3 scans
  { geo: 'TUBING', dims: { thickness: 0, width: 0, length: 12, diameter: 2, od: 0, id_: 0, numScans: 3 }, scanIndex: 0.065, loadTime: 2, hourlyRate: 250, qty: 1, isCScan: false },
];

describe('PARITY: rule engine vs hardcoded formulas', () => {
  for (const tc of testCases) {
    it(`${tc.geo} (qty=${tc.qty}, numScans=${tc.dims.numScans})`, async () => {
      // ── Old hardcoded calculation ──
      const oldDims: OldDims = tc.dims;
      const oldScan = oldComputeScan(tc.geo, oldDims, tc.scanIndex, tc.loadTime, tc.hourlyRate, SCAN_SPEED_DIVISOR);
      const oldLot = oldComputeLot(oldScan.pricePart, tc.qty, customer, tc.isCScan);

      // ── New rule engine calculation ──
      const result = await executeCalculation(
        VERSION_ID, tc.geo, tc.dims, tc.scanIndex, tc.loadTime, tc.hourlyRate,
        SCAN_SPEED_DIVISOR, tc.qty, customerForRules, tc.isCScan,
      );

      // ── Compare scan results ──
      expect(result.scan.indexes).toBeCloseTo(oldScan.indexes, 6);
      expect(result.scan.secPerScanline).toBeCloseTo(oldScan.secPerScanline, 6);
      expect(result.scan.scanTimeMin).toBeCloseTo(oldScan.scanTimeMin, 6);
      expect(result.scan.scanTimeFaceMin).toBeCloseTo(oldScan.scanTimeFaceMin, 6);
      expect(result.scan.totalTimeMin).toBeCloseTo(oldScan.totalTimeMin, 6);
      expect(result.scan.pricePart).toBeCloseTo(oldScan.pricePart, 2);

      // ── Compare lot results ──
      expect(result.lot.extPrice).toBeCloseTo(oldLot.extPrice, 2);
      expect(result.lot.lotCharge).toBeCloseTo(oldLot.lotCharge, 2);
      expect(result.lot.techFee).toBeCloseTo(oldLot.techFee, 2);
      expect(result.lot.subTotal).toBeCloseTo(oldLot.subTotal, 2);
      expect(result.lot.envFee).toBeCloseTo(oldLot.envFee, 2);
      expect(result.lot.grandTotal).toBeCloseTo(oldLot.grandTotal, 2);
    });
  }

  // Weight pricing parity
  it('weight pricing: FLAT_BAR with stainless steel Class A', async () => {
    const dims: Dims = { thickness: 3.625, width: 11.625, length: 15.75, diameter: 0, od: 0, id_: 0, numScans: 1 };

    const oldScan = oldComputeScan('FLAT_BAR', dims, 0.065, 3, 225, SCAN_SPEED_DIVISOR);
    const oldWeight = oldComputeWeight('FLAT_BAR', dims, material, 'A');
    const effectivePrice = Math.max(oldScan.pricePart, oldWeight.weightPrice);
    const oldLot = oldComputeLot(effectivePrice, 1, customer, false);

    const result = await executeCalculation(
      VERSION_ID, 'FLAT_BAR', dims, 0.065, 3, 225,
      SCAN_SPEED_DIVISOR, 1, customerForRules, false,
      materialForRules, 'A', true,
    );

    expect(result.weight).not.toBeNull();
    expect(result.weight!.cubicInches).toBeCloseTo(oldWeight.cubicInches, 4);
    expect(result.weight!.weight).toBeCloseTo(oldWeight.weight, 4);
    expect(result.weight!.weightPrice).toBeCloseTo(oldWeight.weightPrice, 2);
    expect(result.lot.grandTotal).toBeCloseTo(oldLot.grandTotal, 2);
  });

  it('weight pricing: ROUND_BAR with titanium Class AA', async () => {
    const dims: Dims = { thickness: 0, width: 0, length: 18, diameter: 6, od: 0, id_: 0, numScans: 1 };
    const tiMaterial: DbMaterial = {
      id: 'mat-ti', name: 'Titanium',
      density_lb_per_cu_in: 0.160,
      class_a_rate_per_lb: 0.20,
      class_aa_rate_per_lb: 0.25,
    };

    const oldScan = oldComputeScan('ROUND_BAR', dims, 0.065, 3, 225, SCAN_SPEED_DIVISOR);
    const oldWeight = oldComputeWeight('ROUND_BAR', dims, tiMaterial, 'AA');
    const effectivePrice = Math.max(oldScan.pricePart, oldWeight.weightPrice);
    const oldLot = oldComputeLot(effectivePrice, 1, customer, false);

    const result = await executeCalculation(
      VERSION_ID, 'ROUND_BAR', dims, 0.065, 3, 225,
      SCAN_SPEED_DIVISOR, 1, customerForRules, false,
      tiMaterial, 'AA', true,
    );

    expect(result.weight).not.toBeNull();
    expect(result.weight!.cubicInches).toBeCloseTo(oldWeight.cubicInches, 4);
    expect(result.weight!.weightPrice).toBeCloseTo(oldWeight.weightPrice, 2);
    expect(result.lot.grandTotal).toBeCloseTo(oldLot.grandTotal, 2);
  });
});
