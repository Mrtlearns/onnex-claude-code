import { describe, it, expect } from 'vitest'
import {
  computeRates,
  computeFilmSize,
  buildFilmSizeMap,
  computeViewRow,
  computeQuoteTotals,
  computeTierResults,
  fmt,
} from '../calculations'
import type { RtSettings, RtOperator, RtFilmSize, RtPricingTier, RtViewRow } from '../types'

// ── Fixtures ──────────────────────────────────────────────────

const baseSettings: RtSettings = {
  id: 's1',
  burdenMultiplier: 1.3,
  loadedRateMultiplier: 1.2,
  monthlyOhCosts: 0,
  monthlyDirectLabor: 0,
  filmMarkupPct: 0.15,
  sandboxPricePct: 0,
  miscProfitPct: 0.1,
  profitMultiplier: 1,
  salesBonusMultiplier: 1.05,
  shooterMachineCount: 1,
  shooterCrewDivisor: 2,
  darkroomOperatorCount: 1,
  readerCrewCount: 1,
  readerDivisor: 1,
}

const makeOperator = (role: RtOperator['role'], rate: number): RtOperator => ({
  id: crypto.randomUUID(),
  name: 'Test',
  role,
  baseHourlyRate: rate,
  isActive: true,
  sortOrder: 0,
})

const filmSize: RtFilmSize = {
  id: 'fs1',
  label: '4x10',
  width: 4,
  height: 10,
  pricePerBox100: 50,
  isCustom: false,
  sortOrder: 0,
}

const tier: RtPricingTier = {
  id: 't1',
  label: 'Standard',
  singleShotRate: 0.02,
  multiShotRate: 0.015,
  sortOrder: 0,
}

const baseView: RtViewRow = {
  id: 'v1',
  quoteId: 'q1',
  viewNumber: 1,
  filmSizeId: 'fs1',
  shotType: 1,
  qtyPartsPerFilm: 2,
  unpackLoadTime: 5,
  darkroomSortTime: 3,
  shotTime: 10,
  readTime: 4,
  sortOrder: 0,
}

// ── computeRates ──────────────────────────────────────────────

describe('computeRates', () => {
  it('returns zeros when no active operators', () => {
    const rates = computeRates(baseSettings, [])
    expect(rates.shooterCostPerMin).toBe(0)
    expect(rates.darkroomCostPerMin).toBe(0)
    expect(rates.readerCostPerMin).toBe(0)
  })

  it('computes shooter cost per minute correctly', () => {
    const operators = [makeOperator('SHOOTER', 60)]
    const rates = computeRates(baseSettings, operators)
    // avg=60, burden=1.3, loaded=1.2, crewDiv=2, /60min
    const expected = (60 * 1.3 * 1.2) / 2 / 60
    expect(rates.shooterCostPerMin).toBeCloseTo(expected, 6)
  })

  it('averages multiple operators of the same role', () => {
    const operators = [makeOperator('READER', 40), makeOperator('READER', 60)]
    const rates = computeRates(baseSettings, operators)
    // avg=50, burden=1.3, loaded=1.2, readerDiv=1, /60
    const expected = (50 * 1.3 * 1.2) / 1 / 60
    expect(rates.readerCostPerMin).toBeCloseTo(expected, 6)
  })

  it('ignores inactive operators', () => {
    const active = makeOperator('SHOOTER', 60)
    const inactive = { ...makeOperator('SHOOTER', 120), isActive: false }
    const rates = computeRates(baseSettings, [active, inactive])
    const expected = (60 * 1.3 * 1.2) / 2 / 60
    expect(rates.shooterCostPerMin).toBeCloseTo(expected, 6)
  })
})

// ── computeFilmSize ───────────────────────────────────────────

describe('computeFilmSize', () => {
  it('computes sqInches correctly', () => {
    const result = computeFilmSize(filmSize, 0)
    expect(result.sqInches).toBe(40) // 4 * 10
  })

  it('applies markup to cost per sheet', () => {
    const result = computeFilmSize(filmSize, 0.15)
    const base = 50 / 100 // $0.50 per sheet
    expect(result.costPerSheet).toBeCloseTo(base, 6)
    expect(result.costPerSheetMarked).toBeCloseTo(base * 1.15, 6)
  })

  it('zero markup leaves cost unchanged', () => {
    const result = computeFilmSize(filmSize, 0)
    expect(result.costPerSheet).toBeCloseTo(result.costPerSheetMarked, 6)
  })
})

// ── buildFilmSizeMap ──────────────────────────────────────────

describe('buildFilmSizeMap', () => {
  it('returns a map keyed by film size id', () => {
    const map = buildFilmSizeMap([filmSize], 0)
    expect(map.has('fs1')).toBe(true)
    expect(map.get('fs1')?.sqInches).toBe(40)
  })

  it('handles multiple film sizes', () => {
    const fs2: RtFilmSize = { id: 'fs2', label: '5x7', width: 5, height: 7, pricePerBox100: 60, isCustom: false, sortOrder: 1 }
    const map = buildFilmSizeMap([filmSize, fs2], 0)
    expect(map.size).toBe(2)
    expect(map.get('fs2')?.sqInches).toBe(35)
  })
})

// ── computeViewRow ────────────────────────────────────────────

describe('computeViewRow', () => {
  const rates = { shooterCostPerMin: 0.5, darkroomCostPerMin: 0.3, readerCostPerMin: 0.4 }
  const filmMap = buildFilmSizeMap([filmSize], 0)

  it('computes labor cost as sum of shooter + darkroom + reader', () => {
    const calc = computeViewRow(baseView, rates, filmMap, tier)
    expect(calc.laborCost).toBeCloseTo(calc.shooterCost + calc.darkroomCost + calc.readerCost, 6)
  })

  it('computes pricePerView as labor + film cost', () => {
    const calc = computeViewRow(baseView, rates, filmMap, tier)
    expect(calc.pricePerView).toBeCloseTo(calc.laborCost + calc.filmCostPerPart, 6)
  })

  it('uses single-shot rate when shotType=1', () => {
    const calc = computeViewRow({ ...baseView, shotType: 1 }, rates, filmMap, tier)
    const filmCost = (40 * tier.singleShotRate * 1) / baseView.qtyPartsPerFilm
    expect(calc.filmCostPerPart).toBeCloseTo(filmCost, 6)
  })

  it('uses multi-shot rate when shotType>1', () => {
    const multiView = { ...baseView, shotType: 3 as const }
    const calc = computeViewRow(multiView, rates, filmMap, tier)
    const filmCost = (40 * tier.multiShotRate * 3) / baseView.qtyPartsPerFilm
    expect(calc.filmCostPerPart).toBeCloseTo(filmCost, 6)
  })

  it('returns zero film cost when film size not found', () => {
    const calc = computeViewRow({ ...baseView, filmSizeId: 'UNKNOWN' }, rates, filmMap, tier)
    expect(calc.filmCostPerPart).toBe(0)
  })
})

// ── computeQuoteTotals ────────────────────────────────────────

describe('computeQuoteTotals', () => {
  it('returns zeros for empty input', () => {
    const totals = computeQuoteTotals([])
    expect(totals.totalLabor).toBe(0)
    expect(totals.totalFilm).toBe(0)
    expect(totals.totalPrice).toBe(0)
  })

  it('sums labor, film, and price across multiple views', () => {
    const rates = { shooterCostPerMin: 0.5, darkroomCostPerMin: 0.3, readerCostPerMin: 0.4 }
    const filmMap = buildFilmSizeMap([filmSize], 0)
    const calc1 = computeViewRow(baseView, rates, filmMap, tier)
    const calc2 = computeViewRow({ ...baseView, id: 'v2' }, rates, filmMap, tier)
    const totals = computeQuoteTotals([calc1, calc2])
    expect(totals.totalLabor).toBeCloseTo(calc1.laborCost + calc2.laborCost, 6)
    expect(totals.totalPrice).toBeCloseTo(calc1.pricePerView + calc2.pricePerView, 6)
  })
})

// ── computeTierResults ────────────────────────────────────────

describe('computeTierResults', () => {
  it('returns one result per tier', () => {
    const operators = [makeOperator('SHOOTER', 60), makeOperator('DARKROOM_SORT', 40), makeOperator('READER', 50)]
    const rates = computeRates(baseSettings, operators)
    const filmMap = buildFilmSizeMap([filmSize], baseSettings.filmMarkupPct)
    const results = computeTierResults([tier], [baseView], filmMap, rates, baseSettings)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(tier.id)
  })

  it('grandTotal is greater than raw labor + film total (markup applied)', () => {
    const operators = [makeOperator('SHOOTER', 60), makeOperator('DARKROOM_SORT', 40), makeOperator('READER', 50)]
    const rates = computeRates(baseSettings, operators)
    const filmMap = buildFilmSizeMap([filmSize], baseSettings.filmMarkupPct)
    const results = computeTierResults([tier], [baseView], filmMap, rates, baseSettings)
    const viewCalc = computeViewRow(baseView, rates, filmMap, tier)
    const rawTotal = viewCalc.laborCost + viewCalc.filmCostPerPart
    expect(results[0].grandTotal).toBeGreaterThan(rawTotal)
  })
})

// ── fmt ───────────────────────────────────────────────────────

describe('fmt', () => {
  it('formats zero as $0.00', () => {
    expect(fmt(0)).toBe('$0.00')
  })

  it('formats positive number with 2 decimal places', () => {
    expect(fmt(1234.5)).toBe('$1234.50')
  })

  it('rounds correctly', () => {
    expect(fmt(9.999)).toBe('$10.00')
  })
})
