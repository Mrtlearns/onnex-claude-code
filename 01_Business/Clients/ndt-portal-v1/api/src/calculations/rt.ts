import type { RtRatesSnapshot } from '../types/rt-quote';

export interface DbRtSettings {
  id: string;
  burden_multiplier: number;
  loaded_rate_multiplier: number;
  monthly_oh_costs: number;
  monthly_direct_labor: number;
  film_markup_pct: number;
  sandbox_price_pct: number;
  misc_profit_pct: number;
  profit_multiplier: number;
  sales_bonus_multiplier: number;
  shooter_machine_count: number;
  shooter_crew_divisor: number;
  darkroom_operator_count: number;
  reader_crew_count: number;
  reader_divisor: number;
}

export interface DbRtOperator {
  id: string;
  name: string;
  role: 'SHOOTER' | 'DARKROOM_SORT' | 'READER';
  base_hourly_rate: number;
  is_active: boolean;
}

export interface DbRtFilmSize {
  id: string;
  label: string;
  width: number;
  height: number;
  price_per_box_100: number;
}

export interface DbRtPricingTier {
  id: string;
  label: string;
  single_shot_rate: number;
  multi_shot_rate: number;
  sort_order: number;
}

export interface FilmSizeComputed extends DbRtFilmSize {
  sq_inches: number;
  cost_per_sheet: number;
  cost_per_sheet_marked: number;
}

export function computeRates(settings: DbRtSettings, operators: DbRtOperator[]): RtRatesSnapshot {
  // pg driver returns DECIMAL/NUMERIC columns as strings — coerce with unary +
  const active = operators.filter(o => o.is_active);
  const shooters = active.filter(o => o.role === 'SHOOTER');
  const darkroom = active.filter(o => o.role === 'DARKROOM_SORT');
  const readers  = active.filter(o => o.role === 'READER');

  const avgShooter  = shooters.length ? shooters.reduce((s, o) => s + +o.base_hourly_rate, 0) / shooters.length : 0;
  const avgDarkroom = darkroom.length ? darkroom.reduce((s, o) => s + +o.base_hourly_rate, 0) / darkroom.length : 0;
  const avgReader   = readers.length  ? readers.reduce((s, o) => s + +o.base_hourly_rate, 0) / readers.length : 0;

  const b                   = +settings.burden_multiplier;
  const l                   = +settings.loaded_rate_multiplier;
  const shooter_crew_divisor = +settings.shooter_crew_divisor;
  const reader_divisor       = +settings.reader_divisor;

  const shooterCostPerMin  = (avgShooter  * b * l) / shooter_crew_divisor / 60;
  const darkroomCostPerMin = (avgDarkroom * b * l) / 60;
  const readerCostPerMin   = (avgReader   * b * l) / reader_divisor / 60;

  return {
    shooterCostPerMin:  parseFloat(shooterCostPerMin.toFixed(6)),
    darkroomCostPerMin: parseFloat(darkroomCostPerMin.toFixed(6)),
    readerCostPerMin:   parseFloat(readerCostPerMin.toFixed(6)),
  };
}

export function computeFilmSize(fs: DbRtFilmSize, film_markup_pct: number): FilmSizeComputed {
  const sq_inches = +fs.width * +fs.height;
  const cost_per_sheet = +fs.price_per_box_100 / 100;
  const cost_per_sheet_marked = parseFloat((cost_per_sheet * (1 + +film_markup_pct)).toFixed(6));
  return { ...fs, sq_inches, cost_per_sheet, cost_per_sheet_marked };
}

export interface ViewCalcResult {
  shooterCost: number;
  darkroomCost: number;
  readerCost: number;
  laborCost: number;
  filmCostPerPart: number;
  pricePerView: number;
}

export function computeViewRow(
  shotType: number,
  qtyPartsPerFilm: number,
  unpackLoadTime: number,
  darkroomSortTime: number,
  shotTime: number,
  readTime: number,
  rates: RtRatesSnapshot,
  film: FilmSizeComputed,
  tier: DbRtPricingTier,
): ViewCalcResult {
  // Shooter: divide by qty only — do NOT multiply by shotType
  const shooterCost = ((+unpackLoadTime + +shotTime) * rates.shooterCostPerMin) / +qtyPartsPerFilm;

  // Darkroom + Reader: multiply by shotType, then divide by qty
  const effectiveShots = shotType === 0 ? 1 : shotType;
  const darkroomCost = (+darkroomSortTime * effectiveShots * rates.darkroomCostPerMin) / +qtyPartsPerFilm;
  const readerCost   = (+readTime * effectiveShots * rates.readerCostPerMin) / +qtyPartsPerFilm;

  const laborCost = shooterCost + darkroomCost + readerCost;

  // Film: sq_inches x rate x effectiveShots / qty
  const rate = shotType <= 1 ? +tier.single_shot_rate : +tier.multi_shot_rate;
  const filmCostPerPart = (film.sq_inches * rate * effectiveShots) / +qtyPartsPerFilm;

  const pricePerView = laborCost + filmCostPerPart;

  return {
    shooterCost:     parseFloat(shooterCost.toFixed(4)),
    darkroomCost:    parseFloat(darkroomCost.toFixed(4)),
    readerCost:      parseFloat(readerCost.toFixed(4)),
    laborCost:       parseFloat(laborCost.toFixed(4)),
    filmCostPerPart: parseFloat(filmCostPerPart.toFixed(4)),
    pricePerView:    parseFloat(pricePerView.toFixed(4)),
  };
}

export function sumViewCalcs(calcs: ViewCalcResult[]) {
  return calcs.reduce(
    (acc, c) => ({
      totalLabor: acc.totalLabor + c.laborCost,
      totalFilm:  acc.totalFilm  + c.filmCostPerPart,
      totalPrice: acc.totalPrice + c.pricePerView,
    }),
    { totalLabor: 0, totalFilm: 0, totalPrice: 0 },
  );
}

export function computeGrandTotal(
  totals: { totalLabor: number; totalFilm: number; totalPrice: number },
  settings: DbRtSettings,
): number {
  return (totals.totalLabor + totals.totalFilm)
    * (1 + +settings.misc_profit_pct)
    * +settings.sales_bonus_multiplier;
}

export const SHOT_TYPE_LABELS: Record<number, string> = {
  0: 'None', 1: 'Single', 2: 'Double', 3: 'Triple',
};
