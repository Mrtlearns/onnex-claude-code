import { describe, it, expect } from 'vitest'
import {
  rateForGeometry,
  defaultLoadTime,
  computeScan,
  computeWeight,
  effectivePrice,
  computeLot,
} from '../calculations'
import type { UtCustomer, UtDimensions, UtMaterial } from '../types'

// ── Fixtures ──────────────────────────────────────────────────

const customer: UtCustomer = {
  id: 'c1',
  name: 'Test Co',
  hourlyRate: 120,
  cScanRate: 200,
  minCharge: 100,
  cScanMinCharge: 250,
  lotPattern: 'min_enforced',
  hasTechFee: false,
  techniqueFee: 0,
  hasEnvFee: false,
  envFeeRate: 0,
  deliveryFee: '0',
  leadTime: '5 days',
  notes: '',
  isActive: true,
  sortOrder: 0,
}

const flatBarDims: UtDimensions = {
  width: 2,
  thickness: 0.5,
  length: 12,
  diameter: 0,
  od: 0,
  id_: 0,
  numScans: 1,
}

const material: UtMaterial = {
  id: 'm1',
  name: 'Steel',
  densityLbPerCuIn: 0.283,
  classARatePerLb: 1.5,
  classAARatePerLb: 2.0,
  sortOrder: 0,
}

// ── Additional fixtures for rigorous tests ─────────────────────

/** Zero-friction customer: simple lot, no fees, no minimums. Used to isolate roundUp1 & extPrice. */
const customerSimple: UtCustomer = {
  id: 'c-simple',
  name: 'Simple Co',
  hourlyRate: 120,
  cScanRate: 200,
  minCharge: 0,
  cScanMinCharge: 0,
  lotPattern: 'simple',
  hasTechFee: false,
  techniqueFee: 0,
  hasEnvFee: false,
  envFeeRate: 0,
  deliveryFee: '0',
  leadTime: '5 days',
  notes: '',
  isActive: true,
  sortOrder: 0,
}

/** Customer with all fees active: minCharge=100, cScanMinCharge=150, techFee=75, envFee=5%, min_enforced. */
const customerAllFees: UtCustomer = {
  id: 'c-fees',
  name: 'Full Fees Co',
  hourlyRate: 120,
  cScanRate: 200,
  minCharge: 100,
  cScanMinCharge: 150,
  lotPattern: 'min_enforced',
  hasTechFee: true,
  techniqueFee: 75,
  hasEnvFee: true,
  envFeeRate: 0.05,
  deliveryFee: '0',
  leadTime: '5 days',
  notes: '',
  isActive: true,
  sortOrder: 0,
}

const ringDims: UtDimensions = { width: 0, thickness: 0, length: 2, diameter: 0, od: 6, id_: 5, numScans: 1 }
const ringDims2: UtDimensions = { width: 0, thickness: 0, length: 3, diameter: 0, od: 4, id_: 2, numScans: 1 }
const tubingDims: UtDimensions = { width: 0, thickness: 0, length: 24, diameter: 2, od: 0, id_: 0, numScans: 1 }
const thinSheetDims: UtDimensions = { width: 4, thickness: 0, length: 10, diameter: 0, od: 0, id_: 0, numScans: 1 }
const roundDims: UtDimensions = { width: 0, thickness: 0, length: 12, diameter: 2, od: 0, id_: 0, numScans: 1 }
const cscanFlatDims: UtDimensions = { width: 3, thickness: 1, length: 6, diameter: 0, od: 0, id_: 0, numScans: 1 }

/** Steel — classAA rate present. */
const materialSteel: UtMaterial = {
  id: 'm-steel',
  name: 'Steel',
  densityLbPerCuIn: 0.283,
  classARatePerLb: 1.5,
  classAARatePerLb: 2.0,
  sortOrder: 0,
}

/** Titanium — no classAA rate; should fall back to classA rate. */
const materialTitanium: UtMaterial = {
  id: 'm-ti',
  name: 'Titanium',
  densityLbPerCuIn: 0.163,
  classARatePerLb: 3.5,
  classAARatePerLb: undefined as unknown as number,
  sortOrder: 1,
}

// ── rateForGeometry ───────────────────────────────────────────

describe('rateForGeometry', () => {
  it('returns cScanRate for CSCAN_FLAT', () => {
    expect(rateForGeometry('CSCAN_FLAT', customer)).toBe(customer.cScanRate)
  })

  it('returns cScanRate for CSCAN_ROUND', () => {
    expect(rateForGeometry('CSCAN_ROUND', customer)).toBe(customer.cScanRate)
  })

  it('returns 250 for TUBING regardless of customer rate', () => {
    expect(rateForGeometry('TUBING', customer)).toBe(250)
  })

  it('returns hourlyRate for all other geometry types', () => {
    expect(rateForGeometry('FLAT_BAR', customer)).toBe(customer.hourlyRate)
    expect(rateForGeometry('ROUND_BAR', customer)).toBe(customer.hourlyRate)
    expect(rateForGeometry('RING', customer)).toBe(customer.hourlyRate)
    expect(rateForGeometry('THIN_SHEET', customer)).toBe(customer.hourlyRate)
  })
})

// ── defaultLoadTime ───────────────────────────────────────────

describe('defaultLoadTime', () => {
  it('returns 5 for RING', () => {
    expect(defaultLoadTime('RING')).toBe(5)
  })

  it('returns 2 for TUBING', () => {
    expect(defaultLoadTime('TUBING')).toBe(2)
  })

  it('returns 3 for all other geometries', () => {
    expect(defaultLoadTime('FLAT_BAR')).toBe(3)
    expect(defaultLoadTime('ROUND_BAR')).toBe(3)
    expect(defaultLoadTime('CSCAN_FLAT')).toBe(3)
  })
})

// ── computeScan ───────────────────────────────────────────────

describe('computeScan — FLAT_BAR', () => {
  it('calculates indexes as (width + thickness) / scanIndex', () => {
    const result = computeScan('FLAT_BAR', flatBarDims, 0.5, 3, 120, 1)
    // (2 + 0.5) / 0.5 = 5
    expect(result.indexes).toBeCloseTo(5, 6)
  })

  it('totalTimeMin includes loadTime', () => {
    const result = computeScan('FLAT_BAR', flatBarDims, 0.5, 3, 120, 1)
    expect(result.totalTimeMin).toBeCloseTo(result.scanTimeMin + 3, 6)
  })

  it('pricePart is always positive', () => {
    const result = computeScan('FLAT_BAR', flatBarDims, 0.5, 3, 120, 1)
    expect(result.pricePart).toBeGreaterThan(0)
  })
})

describe('computeScan — ROUND_BAR', () => {
  const roundDims: UtDimensions = { ...flatBarDims, diameter: 2 }

  it('uses circumference for indexes', () => {
    const result = computeScan('ROUND_BAR', roundDims, Math.PI, 3, 120, 1)
    // circ = PI * 2, indexes = ceil(2PI / PI) = 2
    expect(result.indexes).toBe(2)
  })
})

describe('computeScan — THIN_SHEET', () => {
  it('applies 2x price multiplier vs CSCAN_FLAT', () => {
    const dims: UtDimensions = { ...flatBarDims, width: 4, length: 10, thickness: 0.1 }
    const resultSheet = computeScan('THIN_SHEET', dims, 0.5, 3, 120, 1)
    const resultFlat = computeScan('CSCAN_FLAT', dims, 0.5, 3, 120, 1)
    expect(resultSheet.pricePart).toBeGreaterThan(resultFlat.pricePart)
  })
})

describe('computeScan — TUBING', () => {
  it('multiplies price by numScans', () => {
    const tubingDims: UtDimensions = { ...flatBarDims, diameter: 1, numScans: 3 }
    const result = computeScan('TUBING', tubingDims, 0.5, 2, 250, 1)
    const single = computeScan('TUBING', { ...tubingDims, numScans: 1 }, 0.5, 2, 250, 1)
    expect(result.pricePart).toBeCloseTo(single.pricePart * 3, 1)
  })
})

// ── computeWeight ─────────────────────────────────────────────

describe('computeWeight', () => {
  it('computes cubic inches for flat bar', () => {
    const result = computeWeight('FLAT_BAR', flatBarDims, material, 'A')
    // thickness * width * length = 0.5 * 2 * 12 = 12
    expect(result.cubicInches).toBeCloseTo(12, 6)
  })

  it('computes weight from cubic inches and density', () => {
    const result = computeWeight('FLAT_BAR', flatBarDims, material, 'A')
    expect(result.weight).toBeCloseTo(12 * material.densityLbPerCuIn, 6)
  })

  it('uses classAARatePerLb for AA inspection class', () => {
    const result = computeWeight('FLAT_BAR', flatBarDims, material, 'AA')
    const expected = Math.ceil(12 * material.densityLbPerCuIn * (material.classAARatePerLb ?? 0) * 10) / 10
    expect(result.weightPrice).toBeCloseTo(expected, 1)
  })

  it('uses classARatePerLb for A inspection class', () => {
    const result = computeWeight('FLAT_BAR', flatBarDims, material, 'A')
    const expected = Math.ceil(12 * material.densityLbPerCuIn * (material.classARatePerLb ?? 0) * 10) / 10
    expect(result.weightPrice).toBeCloseTo(expected, 1)
  })

  it('returns zero cubicInches for RING geometry', () => {
    const result = computeWeight('RING', flatBarDims, material, 'A')
    expect(result.cubicInches).toBe(0)
  })
})

// ── effectivePrice ────────────────────────────────────────────

describe('effectivePrice', () => {
  it('returns scan price when useWeight is false', () => {
    expect(effectivePrice(100, 200, false)).toBe(100)
  })

  it('returns max of scan and weight when useWeight is true', () => {
    expect(effectivePrice(100, 200, true)).toBe(200)
    expect(effectivePrice(300, 200, true)).toBe(300)
  })
})

// ── computeLot ────────────────────────────────────────────────

describe('computeLot', () => {
  it('applies minimum charge when extPrice is below minimum', () => {
    // pricePart=5, qty=5 → extPrice=25, min=100 → lotCharge=100
    const result = computeLot(5, 5, customer, false)
    expect(result.lotCharge).toBe(customer.minCharge)
  })

  it('uses extPrice when it exceeds minimum charge', () => {
    const result = computeLot(30, 10, customer, false)
    expect(result.lotCharge).toBeGreaterThanOrEqual(result.extPrice)
  })

  it('uses cScanMinCharge when useCScan is true', () => {
    const result = computeLot(5, 5, customer, true)
    expect(result.lotCharge).toBe(customer.cScanMinCharge)
  })

  it('adds techFee when hasTechFee is true', () => {
    const withFee = { ...customer, hasTechFee: true, techniqueFee: 50 }
    const result = computeLot(20, 5, withFee, false)
    expect(result.techFee).toBe(50)
    expect(result.subTotal).toBe(result.lotCharge + 50)
  })

  it('adds env fee when hasEnvFee is true', () => {
    const withEnv = { ...customer, hasEnvFee: true, envFeeRate: 0.1 }
    const result = computeLot(20, 5, withEnv, false)
    expect(result.envFee).toBeCloseTo(result.subTotal * 0.1, 1)
    expect(result.grandTotal).toBeCloseTo(result.subTotal + result.envFee, 6)
  })

  it('grandTotal equals subTotal when no env fee', () => {
    const result = computeLot(20, 5, customer, false)
    expect(result.grandTotal).toBe(result.subTotal)
  })
})

// ════════════════════════════════════════════════════════════════
// RIGOROUS MATH TESTS
// All expected values pre-calculated by hand. See plan derivations.
// ════════════════════════════════════════════════════════════════

// ── roundUp1 (tested indirectly via computeLot extPrice) ──────
// Formula: Math.ceil(n * 10) / 10  — always rounds UP to 1 decimal
// customerSimple has no min charge, simple lot, no fees → extPrice = roundUp1(pricePart * qty)

describe('roundUp1 — rounding edge cases', () => {
  it('roundUp1(0) = 0', () => {
    expect(computeLot(0, 1, customerSimple, false).extPrice).toBe(0)
  })

  it('roundUp1(1.0) = 1.0 (exact 1dp unchanged)', () => {
    expect(computeLot(1.0, 1, customerSimple, false).extPrice).toBe(1.0)
  })

  it('roundUp1(1.01) = 1.1 (rounds up)', () => {
    expect(computeLot(1.01, 1, customerSimple, false).extPrice).toBe(1.1)
  })

  it('roundUp1(1.09) = 1.1 (rounds up)', () => {
    expect(computeLot(1.09, 1, customerSimple, false).extPrice).toBe(1.1)
  })

  it('roundUp1(1.10) = 1.1 (exact 1dp unchanged)', () => {
    expect(computeLot(1.10, 1, customerSimple, false).extPrice).toBe(1.1)
  })

  it('roundUp1(1.101) = 1.2 (rounds up at 2nd decimal)', () => {
    expect(computeLot(1.101, 1, customerSimple, false).extPrice).toBe(1.2)
  })

  it('roundUp1(7.5384615) = 7.6 (real FLAT_BAR case)', () => {
    // CEIL(75.384615) / 10 = 76/10 = 7.6
    expect(computeLot(7.5384615, 1, customerSimple, false).extPrice).toBe(7.6)
  })

  it('roundUp1(100.0) = 100.0 (large exact value)', () => {
    expect(computeLot(100.0, 1, customerSimple, false).extPrice).toBe(100.0)
  })
})

// ── computeScan — FLAT_BAR (rigorous) ─────────────────────────
// indexes = (width + thickness) / scanIndex  ← NO Math.ceil (matches Excel)

describe('computeScan — FLAT_BAR rigorous', () => {
  // Standard: w=2, t=0.5, L=12, idx=0.065, hr=120, load=3, spd=10
  // indexes = 2.5/0.065 = 38.46153...
  // scanTimeMin = (38.46153 * 1.2)/60 = 0.76923...
  // totalTimeMin = 3.76923...
  // pricePart = ROUNDUP1((3.76923/60)*120) = ROUNDUP1(7.53846...) = 7.6
  it('standard dimensions: indexes=38.461..., pricePart=7.6', () => {
    const r = computeScan('FLAT_BAR', flatBarDims, 0.065, 3, 120, 10)
    expect(r.indexes).toBeCloseTo(38.46153846, 5)
    expect(r.secPerScanline).toBeCloseTo(1.2, 6)
    expect(r.totalTimeMin).toBeCloseTo(3.76923076, 5)
    expect(r.pricePart).toBe(7.6)
  })

  // No-ceil proof: w=1, t=1, L=10, idx=0.3
  // indexes = 2/0.3 = 6.6666...  — must NOT be ceiled to 7
  // pricePart = ROUNDUP1((3.11111/60)*120) = ROUNDUP1(6.22222) = 6.3
  it('no-ceil proof: indexes is fractional 6.666... (not rounded to 7)', () => {
    const dims: UtDimensions = { ...flatBarDims, width: 1, thickness: 1, length: 10 }
    const r = computeScan('FLAT_BAR', dims, 0.3, 3, 120, 10)
    expect(r.indexes).toBeCloseTo(6.66666666, 5)
    expect(r.indexes).not.toBe(7)
    expect(r.pricePart).toBe(6.3)
  })

  // Very short length: scan time dominates loadTime
  // w=2, t=0.5, L=0.1, idx=0.065, spd=10, load=3, hr=120
  // indexes = 38.46153, secPerScanline = 0.01
  // scanTimeMin = (38.46153 * 0.01)/60 = 0.006410...
  // totalTimeMin = 3.006410..., pricePart = ROUNDUP1(6.01282...) = 6.1
  it('very short part (L=0.1): pricePart=6.1', () => {
    const dims: UtDimensions = { ...flatBarDims, length: 0.1 }
    const r = computeScan('FLAT_BAR', dims, 0.065, 3, 120, 10)
    expect(r.pricePart).toBe(6.1)
  })

  // Tiny part: w=0.5, t=0.25, L=3, idx=0.065, spd=10, load=3, hr=120
  // indexes = 0.75/0.065 = 11.53846...
  // scanTimeMin = (11.53846 * 0.3)/60 = 0.057692...
  // totalTimeMin = 3.057692..., pricePart = ROUNDUP1(6.11538...) = 6.2
  it('tiny part (w=0.5, t=0.25, L=3): pricePart=6.2', () => {
    const dims: UtDimensions = { ...flatBarDims, width: 0.5, thickness: 0.25, length: 3 }
    const r = computeScan('FLAT_BAR', dims, 0.065, 3, 120, 10)
    expect(r.indexes).toBeCloseTo(11.53846, 4)
    expect(r.pricePart).toBe(6.2)
  })
})

// ── computeScan — ROUND_BAR (ceiling proof) ───────────────────
// indexes = CEIL(PI * diameter / scanIndex)

describe('computeScan — ROUND_BAR ceiling proof', () => {
  // d=2, L=10, idx=0.3, hr=120, load=3, spd=10
  // circ = PI*2 = 6.28318..., indexes = CEIL(6.28318/0.3) = CEIL(20.9439...) = 21
  // scanTimeMin = 21/60 = 0.35, totalTimeMin = 3.35
  // pricePart = ROUNDUP1((3.35/60)*120) = ROUNDUP1(6.7) = 6.7
  it('d=2 L=10 idx=0.3: indexes=21 (ceiled from 20.94), pricePart=6.7', () => {
    const dims: UtDimensions = { ...flatBarDims, diameter: 2, length: 10 }
    const r = computeScan('ROUND_BAR', dims, 0.3, 3, 120, 10)
    expect(r.indexes).toBe(21)
    expect(r.pricePart).toBe(6.7)
  })

  // d=1, L=12, idx=0.065, hr=120, load=3, spd=10
  // circ = PI, indexes = CEIL(PI/0.065) = CEIL(48.332...) = 49
  // scanTimeMin = (49*1.2)/60 = 0.98, totalTimeMin = 3.98
  // pricePart = ROUNDUP1((3.98/60)*120) = ROUNDUP1(7.96) = 8.0
  it('d=1 L=12 idx=0.065: indexes=49 (ceiled from 48.33), pricePart=8.0', () => {
    const dims: UtDimensions = { ...flatBarDims, diameter: 1, length: 12 }
    const r = computeScan('ROUND_BAR', dims, 0.065, 3, 120, 10)
    expect(r.indexes).toBe(49)
    expect(r.pricePart).toBe(8.0)
  })
})

// ── computeScan — CSCAN_ROUND ─────────────────────────────────
// Same formula as ROUND_BAR; uses cScanRate (passed as hourlyRate param)

describe('computeScan — CSCAN_ROUND', () => {
  // d=3, L=12, idx=0.065, hr=200 (cScanRate), load=3, spd=10
  // circ = PI*3 = 9.42477..., indexes = CEIL(9.42477/0.065) = CEIL(144.996...) = 145
  // scanTimeMin = (145*1.2)/60 = 174/60 = 2.9, totalTimeMin = 5.9
  // pricePart = ROUNDUP1((5.9/60)*200) = ROUNDUP1(19.6666...) = 19.7
  it('d=3 L=12 idx=0.065 rate=200: indexes=145, pricePart=19.7', () => {
    const dims: UtDimensions = { ...flatBarDims, diameter: 3, length: 12 }
    const r = computeScan('CSCAN_ROUND', dims, 0.065, 3, 200, 10)
    expect(r.indexes).toBe(145)
    expect(r.pricePart).toBe(19.7)
  })
})

// ── computeScan — RING (face scan contribution) ───────────────
// totalTimeMin = scanTimeMin + loadTime + scanTimeFaceMin

describe('computeScan — RING rigorous (face scan included)', () => {
  // od=6, id=5, L=2, idx=0.065, hr=120, load=5, spd=10
  // wallThickness=0.5, circ=PI*6=18.84955...
  // indexes = CEIL(18.84955/0.065) = CEIL(289.993...) = 290
  // scanTimeMin = (290*0.2)/60 = 58/60 = 0.96666...
  // faceIndexes=290, faceSecPerLine=0.5/10=0.05
  // scanTimeFaceMin = (290*0.05)/60 = 14.5/60 = 0.24166...
  // totalTimeMin = 0.96666+5+0.24166 = 6.20833...
  // pricePart = ROUNDUP1((6.20833/60)*120) = ROUNDUP1(12.41666...) = 12.5
  it('od=6 id=5 L=2: indexes=290, scanTimeFaceMin>0, pricePart=12.5', () => {
    const r = computeScan('RING', ringDims, 0.065, 5, 120, 10)
    expect(r.indexes).toBe(290)
    expect(r.scanTimeFaceMin).toBeGreaterThan(0)
    expect(r.scanTimeFaceMin).toBeCloseTo(0.24166, 3)
    expect(r.totalTimeMin).toBeCloseTo(6.20833, 3)
    expect(r.pricePart).toBe(12.5)
  })

  // od=4, id=2, L=3, idx=0.065, hr=120, load=5, spd=10
  // wallThickness=1.0, circ=PI*4=12.56637...
  // indexes = CEIL(12.56637/0.065) = CEIL(193.329...) = 194
  // scanTimeMin = (194*0.3)/60 = 0.97
  // faceSecPerLine = 1.0/10 = 0.1
  // scanTimeFaceMin = (194*0.1)/60 = 0.32333...
  // totalTimeMin = 0.97+5+0.32333 = 6.29333...
  // pricePart = ROUNDUP1(12.5866...) = 12.6
  it('od=4 id=2 L=3: indexes=194, pricePart=12.6', () => {
    const r = computeScan('RING', ringDims2, 0.065, 5, 120, 10)
    expect(r.indexes).toBe(194)
    expect(r.scanTimeFaceMin).toBeCloseTo(0.32333, 3)
    expect(r.pricePart).toBe(12.6)
  })

  it('RING face scan time increases totalTimeMin vs equivalent ROUND_BAR (same OD, same load)', () => {
    // ROUND_BAR with d=6, L=2 has identical scan indexes as RING od=6 but no face scan
    // Therefore RING totalTimeMin > ROUND_BAR totalTimeMin
    const roundEquiv: UtDimensions = { ...flatBarDims, diameter: 6, length: 2 }
    const roundResult = computeScan('ROUND_BAR', roundEquiv, 0.065, 5, 120, 10)
    const ringResult = computeScan('RING', ringDims, 0.065, 5, 120, 10)
    expect(ringResult.scanTimeFaceMin).toBeGreaterThan(0)
    expect(ringResult.totalTimeMin).toBeGreaterThan(roundResult.totalTimeMin)
  })
})

// ── computeScan — CSCAN_FLAT vs THIN_SHEET (2× multiplier) ───

describe('computeScan — THIN_SHEET 2× multiplier vs CSCAN_FLAT', () => {
  // Same dims (w=4, L=10, idx=0.065, spd=10, load=3)
  // CSCAN_FLAT uses rate=200 (cScanRate), THIN_SHEET uses rate=120 (hourlyRate)
  //
  // CSCAN_FLAT: indexes=CEIL(4/0.065)=62, scanTimeMin=62/60=1.03333, totalTimeMin=4.03333
  //   pricePart = ROUNDUP1((4.03333/60)*200) = ROUNDUP1(13.4444) = 13.5
  //
  // THIN_SHEET: same indexes=62, same totalTimeMin=4.03333
  //   pricePart = ROUNDUP1((4.03333/60)*120*2) = ROUNDUP1(16.1333) = 16.2
  it('CSCAN_FLAT (rate=200): indexes=62, pricePart=13.5', () => {
    const r = computeScan('CSCAN_FLAT', thinSheetDims, 0.065, 3, 200, 10)
    expect(r.indexes).toBe(62)
    expect(r.totalTimeMin).toBeCloseTo(4.03333, 3)
    expect(r.pricePart).toBe(13.5)
  })

  it('THIN_SHEET (rate=120, 2× multiplier): same indexes=62, pricePart=16.2', () => {
    const r = computeScan('THIN_SHEET', thinSheetDims, 0.065, 3, 120, 10)
    expect(r.indexes).toBe(62)
    expect(r.totalTimeMin).toBeCloseTo(4.03333, 3)
    expect(r.pricePart).toBe(16.2)
  })

  it('THIN_SHEET and CSCAN_FLAT share identical indexes and totalTimeMin (same scan formula)', () => {
    const rSheet = computeScan('THIN_SHEET', thinSheetDims, 0.065, 3, 120, 10)
    const rFlat = computeScan('CSCAN_FLAT', thinSheetDims, 0.065, 3, 120, 10)
    expect(rSheet.indexes).toBe(rFlat.indexes)
    expect(rSheet.totalTimeMin).toBeCloseTo(rFlat.totalTimeMin, 8)
  })
})

// ── computeScan — TUBING (numScans linear scaling) ────────────
// TUBING rate is always 250 (hardcoded), loadTime=2
// pricePart = pricePerScan * numScans

describe('computeScan — TUBING numScans linear scaling', () => {
  // d=2, L=24, idx=0.065, hr=250, load=2, spd=10
  // circ=PI*2=6.28318, indexes=CEIL(6.28318/0.065)=CEIL(96.663...)=97
  // secPerScanline=2.4, scanTimeMin=(97*2.4)/60=3.88
  // totalTimeMin=3.88+2=5.88
  // pricePerScan=ROUNDUP1((5.88/60)*250)=ROUNDUP1(24.5)=24.5
  it('1 scan: indexes=97, pricePerScan=24.5, pricePart=24.5', () => {
    const r = computeScan('TUBING', tubingDims, 0.065, 2, 250, 10)
    expect(r.indexes).toBe(97)
    expect(r.pricePart).toBe(24.5)
  })

  it('3 scans: pricePart=73.5 (exact linear: 24.5 × 3)', () => {
    const r = computeScan('TUBING', { ...tubingDims, numScans: 3 }, 0.065, 2, 250, 10)
    expect(r.pricePart).toBe(73.5)
  })

  it('5 scans: pricePart=122.5 (exact linear: 24.5 × 5)', () => {
    const r = computeScan('TUBING', { ...tubingDims, numScans: 5 }, 0.065, 2, 250, 10)
    expect(r.pricePart).toBe(122.5)
  })

  it('pricePart scales exactly with numScans (no compounding rounding)', () => {
    const r1 = computeScan('TUBING', { ...tubingDims, numScans: 1 }, 0.065, 2, 250, 10)
    const r3 = computeScan('TUBING', { ...tubingDims, numScans: 3 }, 0.065, 2, 250, 10)
    expect(r3.pricePart).toBeCloseTo(r1.pricePart * 3, 6)
  })
})

// ── computeWeight — all geometries, class A/AA, fallback ──────

describe('computeWeight — rigorous', () => {
  // FLAT_BAR: cubicInches = t * w * L = 0.5*2*12 = 12
  // weight = 12 * 0.283 = 3.396
  // classA: ROUNDUP1(3.396*1.5) = ROUNDUP1(5.094) = 5.1
  // classAA: ROUNDUP1(3.396*2.0) = ROUNDUP1(6.792) = 6.8
  it('FLAT_BAR cubicInches = t×w×L = 12.0', () => {
    expect(computeWeight('FLAT_BAR', flatBarDims, materialSteel, 'A').cubicInches).toBeCloseTo(12.0, 8)
  })

  it('FLAT_BAR class A: weightPrice=5.1', () => {
    expect(computeWeight('FLAT_BAR', flatBarDims, materialSteel, 'A').weightPrice).toBe(5.1)
  })

  it('FLAT_BAR class AA: weightPrice=6.8', () => {
    expect(computeWeight('FLAT_BAR', flatBarDims, materialSteel, 'AA').weightPrice).toBe(6.8)
  })

  // Class AA with no classAARatePerLb → falls back to classARatePerLb
  it('FLAT_BAR class AA with no classAARatePerLb: falls back to classA rate (5.1)', () => {
    expect(computeWeight('FLAT_BAR', flatBarDims, materialTitanium, 'AA').weightPrice).toBe(
      computeWeight('FLAT_BAR', flatBarDims, materialTitanium, 'A').weightPrice
    )
  })

  // Class A always uses classARatePerLb regardless of classAA availability
  it('FLAT_BAR class A always uses classARatePerLb (ignores classAA rate)', () => {
    const resultA = computeWeight('FLAT_BAR', flatBarDims, materialSteel, 'A')
    // weight=3.396, rate=1.5 → 5.094 → 5.1
    expect(resultA.weightPrice).toBe(5.1)
    // NOT 6.8 (which would use classAA rate)
    expect(resultA.weightPrice).not.toBe(6.8)
  })

  // ROUND_BAR: cubicInches = PI * (d/2)^2 * L = PI * 1^2 * 12 = 37.699...
  // weight = 37.699 * 0.283 = 10.669
  // classA: ROUNDUP1(10.669 * 1.5) = ROUNDUP1(16.003...) = 16.1
  it('ROUND_BAR cubicInches = π×r²×L (d=2, L=12): ≈37.699', () => {
    expect(computeWeight('ROUND_BAR', roundDims, materialSteel, 'A').cubicInches).toBeCloseTo(Math.PI * 12, 4)
  })

  it('ROUND_BAR class A: weightPrice=16.1', () => {
    expect(computeWeight('ROUND_BAR', roundDims, materialSteel, 'A').weightPrice).toBe(16.1)
  })

  // CSCAN_FLAT: same flat formula as FLAT_BAR
  // cscanFlatDims: t=1, w=3, L=6 → cubicInches=18
  // weight=18*0.283=5.094
  // classA: ROUNDUP1(5.094*1.5)=ROUNDUP1(7.641)=7.7
  it('CSCAN_FLAT cubicInches = t×w×L = 18.0', () => {
    expect(computeWeight('CSCAN_FLAT', cscanFlatDims, materialSteel, 'A').cubicInches).toBeCloseTo(18.0, 8)
  })

  it('CSCAN_FLAT class A: weightPrice=7.7', () => {
    expect(computeWeight('CSCAN_FLAT', cscanFlatDims, materialSteel, 'A').weightPrice).toBe(7.7)
  })

  // RING: returns zero (not eligible for weight pricing)
  it('RING returns cubicInches=0 and weightPrice=0', () => {
    const r = computeWeight('RING', ringDims, materialSteel, 'A')
    expect(r.cubicInches).toBe(0)
    expect(r.weight).toBe(0)
    expect(r.weightPrice).toBe(0)
  })

  // TUBING: returns zero (not eligible for weight pricing)
  it('TUBING returns cubicInches=0 and weightPrice=0', () => {
    const r = computeWeight('TUBING', tubingDims, materialSteel, 'A')
    expect(r.cubicInches).toBe(0)
    expect(r.weightPrice).toBe(0)
  })

  // THIN_SHEET: same flat formula
  it('THIN_SHEET cubicInches = t×w×L', () => {
    const dims: UtDimensions = { ...flatBarDims, width: 4, thickness: 0.1, length: 10 }
    expect(computeWeight('THIN_SHEET', dims, materialSteel, 'A').cubicInches).toBeCloseTo(4.0, 8)
  })
})

// ── effectivePrice — all combinations ─────────────────────────

describe('effectivePrice — all combinations', () => {
  it('useWeight=false: returns scanPrice even when weightPrice > scanPrice', () => {
    expect(effectivePrice(10, 999, false)).toBe(10)
  })

  it('useWeight=true, scanPrice > weightPrice: returns scanPrice', () => {
    expect(effectivePrice(10, 5, true)).toBe(10)
  })

  it('useWeight=true, weightPrice > scanPrice: returns weightPrice', () => {
    expect(effectivePrice(5, 10, true)).toBe(10)
  })

  it('useWeight=true, equal prices: returns the value (either is correct)', () => {
    expect(effectivePrice(7, 7, true)).toBe(7)
  })
})

// ── computeLot — comprehensive combinations ───────────────────

describe('computeLot — lot patterns, fees, minimums', () => {
  // ── Simple lot pattern ──

  it('simple pattern, no fees: grandTotal = extPrice = pricePart×qty', () => {
    // pricePart=15, qty=5 → extPrice=ROUNDUP1(75)=75.0
    const r = computeLot(15, 5, { ...customerAllFees, lotPattern: 'simple', hasTechFee: false, hasEnvFee: false }, false)
    expect(r.extPrice).toBe(75.0)
    expect(r.lotCharge).toBe(75.0)
    expect(r.techFee).toBe(0)
    expect(r.envFee).toBe(0)
    expect(r.grandTotal).toBe(75.0)
  })

  it('simple pattern ignores minCharge (no enforcement)', () => {
    // extPrice=40 < minCharge=100 but simple pattern → lotCharge stays 40
    const r = computeLot(8, 5, { ...customerAllFees, lotPattern: 'simple', hasTechFee: false, hasEnvFee: false }, false)
    expect(r.extPrice).toBe(40.0)
    expect(r.lotCharge).toBe(40.0) // not enforced to 100
  })

  it('simple pattern, all fees active: subTotal=lotCharge+techFee, envFee on subTotal', () => {
    // pricePart=15, qty=5 → extPrice=75, lotCharge=75
    // techFee=75, subTotal=150
    // envFee=ROUNDUP1(150*0.05)=ROUNDUP1(7.5)=7.5
    // grandTotal=157.5
    const r = computeLot(15, 5, { ...customerAllFees, lotPattern: 'simple' }, false)
    expect(r.extPrice).toBe(75.0)
    expect(r.lotCharge).toBe(75.0)
    expect(r.techFee).toBe(75)
    expect(r.subTotal).toBe(150.0)
    expect(r.envFee).toBe(7.5)
    expect(r.grandTotal).toBe(157.5)
  })

  // ── min_enforced lot pattern ──

  it('min_enforced, extPrice > minCharge: lotCharge = extPrice', () => {
    // pricePart=15, qty=10 → extPrice=150 > minCharge=100 → lotCharge=150
    const r = computeLot(15, 10, { ...customerAllFees, hasTechFee: false, hasEnvFee: false }, false)
    expect(r.extPrice).toBe(150.0)
    expect(r.lotCharge).toBe(150.0)
    expect(r.grandTotal).toBe(150.0)
  })

  it('min_enforced, extPrice < minCharge: lotCharge = minCharge', () => {
    // pricePart=8, qty=5 → extPrice=40 < minCharge=100 → lotCharge=100
    const r = computeLot(8, 5, { ...customerAllFees, hasTechFee: false, hasEnvFee: false }, false)
    expect(r.extPrice).toBe(40.0)
    expect(r.lotCharge).toBe(100.0)
    expect(r.grandTotal).toBe(100.0)
  })

  it('min_enforced, extPrice === minCharge (boundary): lotCharge = minCharge', () => {
    // pricePart=10, qty=10 → extPrice=100 === minCharge=100 → lotCharge=100
    const r = computeLot(10, 10, { ...customerAllFees, hasTechFee: false, hasEnvFee: false }, false)
    expect(r.extPrice).toBe(100.0)
    expect(r.lotCharge).toBe(100.0)
    expect(r.grandTotal).toBe(100.0)
  })

  // ── cScan minimum charge ──

  it('useCScan=true applies cScanMinCharge (not minCharge)', () => {
    // pricePart=10, qty=5 → extPrice=50 < cScanMinCharge=150 → lotCharge=150
    const r = computeLot(10, 5, { ...customerAllFees, hasTechFee: false, hasEnvFee: false }, true)
    expect(r.extPrice).toBe(50.0)
    expect(r.lotCharge).toBe(150.0)
    expect(r.grandTotal).toBe(150.0)
  })

  // ── Quantity scaling ──

  it('qty=1: extPrice = pricePart (single piece)', () => {
    const r = computeLot(50, 1, customerSimple, false)
    expect(r.extPrice).toBe(50.0)
    expect(r.grandTotal).toBe(50.0)
  })

  it('qty=100: extPrice = ROUNDUP1(pricePart * 100)', () => {
    // 1.5 * 100 = 150.0 → ROUNDUP1(150) = 150.0
    const r = computeLot(1.5, 100, customerSimple, false)
    expect(r.extPrice).toBe(150.0)
    expect(r.grandTotal).toBe(150.0)
  })
})

// ── computeLot — envFee is on subTotal (not lotCharge alone) ──
// This is a critical correctness test. envFee = ROUNDUP1(subTotal * envFeeRate)
// where subTotal = lotCharge + techFee
// NOT ROUNDUP1(lotCharge * envFeeRate)

describe('computeLot — envFee applies to subTotal (lotCharge + techFee)', () => {
  it('envFee is on subTotal = lotCharge+techFee, not just lotCharge', () => {
    // pricePart=50, qty=2 → extPrice=100, lotCharge=MAX(100,100)=100
    // techFee=75, subTotal=175
    // envFee=ROUNDUP1(175*0.05)=ROUNDUP1(8.75)=8.8
    // grandTotal=183.8
    // (if envFee were on lotCharge only: ROUNDUP1(100*0.05)=5.0 → total=180 — WRONG)
    const r = computeLot(50, 2, customerAllFees, false)
    expect(r.lotCharge).toBe(100.0)
    expect(r.techFee).toBe(75)
    expect(r.subTotal).toBe(175.0)
    expect(r.envFee).toBe(8.8)       // NOT 5.0 (which would be envFee on lotCharge)
    expect(r.grandTotal).toBe(183.8)
  })

  it('techFee=0: subTotal=lotCharge, envFee same whether based on subTotal or lotCharge', () => {
    // This confirms the formula is consistent when techFee=0
    const r = computeLot(50, 2, { ...customerAllFees, hasTechFee: false }, false)
    expect(r.techFee).toBe(0)
    expect(r.subTotal).toBe(r.lotCharge)
    // envFee = ROUNDUP1(subTotal * 0.05) = ROUNDUP1(100 * 0.05) = ROUNDUP1(5.0) = 5.0
    expect(r.envFee).toBe(5.0)
    expect(r.grandTotal).toBe(105.0)
  })
})
