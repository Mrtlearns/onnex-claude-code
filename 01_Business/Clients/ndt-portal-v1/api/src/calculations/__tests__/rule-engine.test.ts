/**
 * Rule engine tests — verify executeCalculation produces correct results
 * for all geometry types. These tests mock the DB layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB module before importing rule engine
vi.mock('../../db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

import { query, queryOne } from '../../db';
import { executeCalculation, type DbCustomerForRules, type DbMaterialForRules, type Dims } from '../rule-engine';

// ── Test Fixtures ────────────────────────────────────────────────

const VERSION_ID = '00000000-0000-0000-0002-000000000001';

const mockVersionInfo = { version: 1, rs_name: 'default' };

const mockCustomer: DbCustomerForRules = {
  id: 'cust-001',
  hourly_rate: 225,
  cscan_rate: 250,
  technique_fee: 125,
  env_fee_rate: 0.02,
  min_charge: 225,
  cscan_min_charge: 250,
  has_env_fee: true,
  has_tech_fee: true,
  lot_pattern: 'min_enforced',
  rule_set_id: null,
  rule_version_pin: null,
};

const mockMaterial: DbMaterialForRules = {
  id: 'mat-001',
  density_lb_per_cu_in: 0.290,
  class_a_rate_per_lb: 0.12,
  class_aa_rate_per_lb: 0.14,
};

// Rule definitions matching the seed migration
function buildMockRules(geoType: string) {
  const scanFormulas: Record<string, { geometry: string; steps: Array<{ name: string; expr: string }> }> = {
    FLAT_BAR: {
      geometry: 'FLAT_BAR',
      steps: [
        { name: 'indexes', expr: '(dims.width + dims.thickness) / scanIndex' },
        { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
        { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
        { name: 'scanTimeFaceMin', expr: '0' },
        { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
      ],
    },
    ROUND_BAR: {
      geometry: 'ROUND_BAR',
      steps: [
        { name: 'circ', expr: 'PI * dims.diameter' },
        { name: 'indexes', expr: 'CEIL(circ / scanIndex)' },
        { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
        { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
        { name: 'scanTimeFaceMin', expr: '0' },
        { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
      ],
    },
    RING: {
      geometry: 'RING',
      steps: [
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
    },
    TUBING: {
      geometry: 'TUBING',
      steps: [
        { name: 'circ', expr: 'PI * dims.diameter' },
        { name: 'indexes', expr: 'CEIL(circ / scanIndex)' },
        { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
        { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
        { name: 'scanTimeFaceMin', expr: '0' },
        { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
      ],
    },
    CSCAN_FLAT: {
      geometry: 'CSCAN_FLAT',
      steps: [
        { name: 'indexes', expr: 'CEIL(dims.width / scanIndex)' },
        { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
        { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
        { name: 'scanTimeFaceMin', expr: '0' },
        { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
      ],
    },
    THIN_SHEET: {
      geometry: 'THIN_SHEET',
      steps: [
        { name: 'indexes', expr: 'CEIL(dims.width / scanIndex)' },
        { name: 'secPerScanline', expr: 'dims.length / scanSpeedDivisor' },
        { name: 'scanTimeMin', expr: '(indexes * secPerScanline) / 60' },
        { name: 'scanTimeFaceMin', expr: '0' },
        { name: 'totalTimeMin', expr: 'scanTimeMin + loadTime' },
      ],
    },
  };

  const priceModifiers: Record<string, { geometry: string; steps: Array<{ name: string; expr: string }> }> = {
    THIN_SHEET: {
      geometry: 'THIN_SHEET',
      steps: [{ name: 'pricePart', expr: 'ROUNDUP1((totalTimeMin / 60) * hourlyRate * 2)' }],
    },
    TUBING: {
      geometry: 'TUBING',
      steps: [
        { name: 'pricePerScan', expr: 'ROUNDUP1((totalTimeMin / 60) * hourlyRate)' },
        { name: 'pricePart', expr: 'pricePerScan * dims.numScans' },
      ],
    },
    '*': {
      geometry: '*',
      steps: [{ name: 'pricePart', expr: 'ROUNDUP1((totalTimeMin / 60) * hourlyRate)' }],
    },
  };

  const scanFormula = scanFormulas[geoType] ?? scanFormulas.CSCAN_FLAT;
  const priceModifier = priceModifiers[geoType] ?? priceModifiers['*'];

  return [
    // scan_formula for the requested geometry
    {
      id: 'r-scan',
      category: 'scan_formula',
      geometry_type: geoType,
      sort_order: 0,
      label: `${geoType} scan formula`,
      definition: { type: 'formula', ...scanFormula },
    },
    // price_modifier for the geometry (if specific) + default
    ...(priceModifiers[geoType] ? [{
      id: 'r-price-specific',
      category: 'price_modifier',
      geometry_type: geoType,
      sort_order: 0,
      label: `${geoType} price modifier`,
      definition: { type: 'formula', ...priceModifier },
    }] : []),
    {
      id: 'r-price-default',
      category: 'price_modifier',
      geometry_type: '*',
      sort_order: 10,
      label: 'Default price modifier',
      definition: { type: 'formula', ...priceModifiers['*'] },
    },
    // weight_formula
    {
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
    },
    // lot_calculation
    {
      id: 'r-lot',
      category: 'lot_calculation',
      geometry_type: null,
      sort_order: 0,
      label: 'Lot calculation',
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
    },
  ];
}

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Mock queryOne for version info lookup
  (queryOne as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
    if (sql.includes('rule_set_versions') && sql.includes('rs.name')) {
      return mockVersionInfo;
    }
    return null;
  });
});

function setupMockRules(geoType: string) {
  (query as ReturnType<typeof vi.fn>).mockResolvedValue(buildMockRules(geoType));
}

// ── Tests ────────────────────────────────────────────────────────

describe('executeCalculation', () => {
  it('FLAT_BAR: correct indexes, time, and price', async () => {
    setupMockRules('FLAT_BAR');
    const dims: Dims = { thickness: 3.625, width: 11.625, length: 15.75, diameter: 0, od: 0, id_: 0, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'FLAT_BAR', dims, 0.065, 3, 225, 10, 1, mockCustomer, false,
    );

    // indexes = (11.625 + 3.625) / 0.065 = 234.615...
    expect(result.scan.indexes).toBeCloseTo(234.615, 2);
    expect(result.scan.secPerScanline).toBeCloseTo(1.575, 3);
    expect(result.scan.scanTimeFaceMin).toBe(0);
    expect(result.scan.pricePart).toBeGreaterThan(0);
    expect(result.lot.grandTotal).toBeGreaterThan(0);
    expect(result.trace.steps.length).toBeGreaterThan(5);
  });

  it('ROUND_BAR: circumference-based indexes', async () => {
    setupMockRules('ROUND_BAR');
    const dims: Dims = { thickness: 0, width: 0, length: 12, diameter: 4, od: 0, id_: 0, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'ROUND_BAR', dims, 0.065, 3, 225, 10, 1, mockCustomer, false,
    );

    const expectedIndexes = Math.ceil(Math.PI * 4 / 0.065);
    expect(result.scan.indexes).toBe(expectedIndexes);
  });

  it('RING: includes face scan time', async () => {
    setupMockRules('RING');
    const dims: Dims = { thickness: 0, width: 0, length: 6, diameter: 0, od: 10, id_: 6, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'RING', dims, 0.065, 5, 225, 10, 1, mockCustomer, false,
    );

    expect(result.scan.scanTimeFaceMin).toBeGreaterThan(0);
    // totalTimeMin should include scanTimeMin + loadTime + scanTimeFaceMin
    expect(result.scan.totalTimeMin).toBeGreaterThan(result.scan.scanTimeMin + 5);
  });

  it('TUBING: price multiplied by numScans', async () => {
    setupMockRules('TUBING');
    const dims1: Dims = { thickness: 0, width: 0, length: 12, diameter: 2, od: 0, id_: 0, numScans: 1 };
    const dims3: Dims = { ...dims1, numScans: 3 };

    const result1 = await executeCalculation(
      VERSION_ID, 'TUBING', dims1, 0.065, 2, 250, 10, 1, mockCustomer, false,
    );
    const result3 = await executeCalculation(
      VERSION_ID, 'TUBING', dims3, 0.065, 2, 250, 10, 1, mockCustomer, false,
    );

    // 3 scans should have 3x the pricePart (pricePerScan * numScans)
    const pricePerScan = result1.scan.pricePart;
    expect(result3.scan.pricePart).toBeCloseTo(pricePerScan * 3, 2);
  });

  it('THIN_SHEET: 2x price multiplier', async () => {
    setupMockRules('THIN_SHEET');
    const dims: Dims = { thickness: 0.125, width: 24, length: 36, diameter: 0, od: 0, id_: 0, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'THIN_SHEET', dims, 0.065, 3, 225, 10, 1, mockCustomer, false,
    );

    // pricePart should be ROUNDUP1((totalTimeMin / 60) * 225 * 2)
    const expectedPricePart = Math.ceil(((result.scan.totalTimeMin / 60) * 225 * 2) * 10) / 10;
    expect(result.scan.pricePart).toBe(expectedPricePart);
  });

  it('lot calculation: min charge enforcement', async () => {
    setupMockRules('FLAT_BAR');
    // Small part — price should be less than min charge
    const dims: Dims = { thickness: 0.5, width: 1, length: 2, diameter: 0, od: 0, id_: 0, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'FLAT_BAR', dims, 0.065, 3, 225, 10, 1, mockCustomer, false,
    );

    // With min_enforced, lotCharge should be at least minCharge (225)
    expect(result.lot.lotCharge).toBeGreaterThanOrEqual(225);
  });

  it('lot calculation: tech fee and env fee', async () => {
    setupMockRules('FLAT_BAR');
    const dims: Dims = { thickness: 0.5, width: 1, length: 2, diameter: 0, od: 0, id_: 0, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'FLAT_BAR', dims, 0.065, 3, 225, 10, 1, mockCustomer, false,
    );

    expect(result.lot.techFee).toBe(125); // has_tech_fee = true, technique_fee = 125
    expect(result.lot.envFee).toBeGreaterThan(0); // has_env_fee = true
    expect(result.lot.grandTotal).toBe(result.lot.subTotal + result.lot.envFee);
  });

  it('trace contains all steps with named inputs', async () => {
    setupMockRules('FLAT_BAR');
    const dims: Dims = { thickness: 3.625, width: 11.625, length: 15.75, diameter: 0, od: 0, id_: 0, numScans: 1 };

    const result = await executeCalculation(
      VERSION_ID, 'FLAT_BAR', dims, 0.065, 3, 225, 10, 1, mockCustomer, false,
    );

    expect(result.trace.ruleSetName).toBe('default');
    expect(result.trace.ruleSetVersion).toBe(1);
    expect(result.trace.geometryType).toBe('FLAT_BAR');
    expect(result.trace.steps.length).toBeGreaterThan(0);

    // Check first step has named inputs
    const firstStep = result.trace.steps[0];
    expect(firstStep.ruleName).toBe('indexes');
    expect(firstStep.ruleCategory).toBe('scan_formula');
    expect(firstStep.expression).toBe('(dims.width + dims.thickness) / scanIndex');
    expect(Object.keys(firstStep.namedInputs).length).toBeGreaterThan(0);
  });
});
