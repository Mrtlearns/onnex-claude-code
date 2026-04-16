import type { RtSettings, RtOperator, RtFilmSize, RtFilmSizeComputed, RtPricingTier, RtViewRow, RtRates, RtViewCalc, RtQuoteTotals, RtTierResult } from './types';

export function computeRates(settings: RtSettings, operators: RtOperator[]): RtRates {
  const active = operators.filter(o => o.isActive);
  const shooters = active.filter(o => o.role === 'SHOOTER');
  const darkroom = active.filter(o => o.role === 'DARKROOM_SORT');
  const readers = active.filter(o => o.role === 'READER');

  const avgShooter = shooters.length ? shooters.reduce((s, o) => s + o.baseHourlyRate, 0) / shooters.length : 0;
  const avgDarkroom = darkroom.length ? darkroom.reduce((s, o) => s + o.baseHourlyRate, 0) / darkroom.length : 0;
  const avgReader = readers.length ? readers.reduce((s, o) => s + o.baseHourlyRate, 0) / readers.length : 0;

  const { burdenMultiplier: b, loadedRateMultiplier: l, shooterCrewDivisor, readerDivisor } = settings;

  // Cost per minute per machine
  const shooterCostPerMin = (avgShooter * b * l) / shooterCrewDivisor / 60;
  const darkroomCostPerMin = (avgDarkroom * b * l) / 60;
  const readerCostPerMin = (avgReader * b * l) / readerDivisor / 60;

  return { shooterCostPerMin, darkroomCostPerMin, readerCostPerMin };
}

export function computeFilmSize(fs: RtFilmSize, filmMarkupPct: number): RtFilmSizeComputed {
  const sqInches = fs.width * fs.height;
  const costPerSheet = fs.pricePerBox100 / 100;
  const costPerSheetMarked = costPerSheet * (1 + filmMarkupPct);
  return { ...fs, sqInches, costPerSheet, costPerSheetMarked };
}

export function buildFilmSizeMap(filmSizes: RtFilmSize[], filmMarkupPct: number): Map<string, RtFilmSizeComputed> {
  const map = new Map<string, RtFilmSizeComputed>();
  for (const fs of filmSizes) {
    map.set(fs.id, computeFilmSize(fs, filmMarkupPct));
  }
  return map;
}

export function computeViewRow(
  view: RtViewRow,
  rates: RtRates,
  filmSizeMap: Map<string, RtFilmSizeComputed>,
  pricingTier: RtPricingTier,
): RtViewCalc {
  const fs = filmSizeMap.get(view.filmSizeId);
  const { shotType, qtyPartsPerFilm, unpackLoadTime, darkroomSortTime, shotTime, readTime } = view;

  // Shooter: divide by qty (no shot multiplier)
  const shooterCost = ((unpackLoadTime + shotTime) * rates.shooterCostPerMin) / qtyPartsPerFilm;

  // Darkroom + Reader: multiply by shotType then divide by qty
  const effectiveShots = shotType === 0 ? 1 : shotType;
  const darkroomCost = (darkroomSortTime * effectiveShots * rates.darkroomCostPerMin) / qtyPartsPerFilm;
  const readerCost = (readTime * effectiveShots * rates.readerCostPerMin) / qtyPartsPerFilm;

  const laborCost = shooterCost + darkroomCost + readerCost;

  // Film cost
  const rate = shotType <= 1 ? pricingTier.singleShotRate : pricingTier.multiShotRate;
  const filmCostPerPart = fs ? (fs.sqInches * rate * effectiveShots) / qtyPartsPerFilm : 0;

  const pricePerView = laborCost + filmCostPerPart;

  return { shooterCost, darkroomCost, readerCost, laborCost, filmCostPerPart, pricePerView };
}

export function computeQuoteTotals(calcs: RtViewCalc[]): RtQuoteTotals {
  return calcs.reduce(
    (acc, c) => ({
      totalLabor: acc.totalLabor + c.laborCost,
      totalFilm: acc.totalFilm + c.filmCostPerPart,
      totalPrice: acc.totalPrice + c.pricePerView,
    }),
    { totalLabor: 0, totalFilm: 0, totalPrice: 0 },
  );
}

export function computeTierResults(
  tiers: RtPricingTier[],
  views: RtViewRow[],
  filmSizeMap: Map<string, RtFilmSizeComputed>,
  rates: RtRates,
  settings: RtSettings,
): RtTierResult[] {
  return tiers.map(tier => {
    const calcs = views.map(v => computeViewRow(v, rates, filmSizeMap, tier));
    const totals = computeQuoteTotals(calcs);
    const filmTotal = totals.totalFilm;
    const grandTotal = (totals.totalLabor + filmTotal) * (1 + settings.miscProfitPct) * settings.salesBonusMultiplier;
    return { ...tier, filmTotal, grandTotal };
  });
}

export function fmt(n: number): string {
  return '$' + n.toFixed(2);
}
