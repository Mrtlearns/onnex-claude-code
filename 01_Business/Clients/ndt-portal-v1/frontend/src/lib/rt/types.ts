export interface RtSettings {
  id: string;
  burdenMultiplier: number;
  loadedRateMultiplier: number;
  monthlyOhCosts: number;
  monthlyDirectLabor: number;
  filmMarkupPct: number;
  sandboxPricePct: number;
  miscProfitPct: number;
  profitMultiplier: number;
  salesBonusMultiplier: number;
  shooterMachineCount: number;
  shooterCrewDivisor: number;
  darkroomOperatorCount: number;
  readerCrewCount: number;
  readerDivisor: number;
}

export type OperatorRole = 'SHOOTER' | 'DARKROOM_SORT' | 'READER';

export interface RtOperator {
  id: string;
  name: string;
  role: OperatorRole;
  baseHourlyRate: number;
  isActive: boolean;
  sortOrder: number;
}

export interface RtFilmSize {
  id: string;
  label: string;
  width: number;
  height: number;
  pricePerBox100: number;
  isCustom: boolean;
  sortOrder: number;
}

export interface RtFilmSizeComputed extends RtFilmSize {
  sqInches: number;
  costPerSheet: number;
  costPerSheetMarked: number;
}

export interface RtPricingTier {
  id: string;
  label: string;
  singleShotRate: number;
  multiShotRate: number;
  sortOrder: number;
}

export interface RtPartQuote {
  id: string;
  partNumber: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RtViewRow {
  id: string;
  quoteId: string;
  viewNumber: number;
  shotType: 0 | 1 | 2 | 3;
  qtyPartsPerFilm: number;
  filmSizeId: string;
  unpackLoadTime: number;
  darkroomSortTime: number;
  shotTime: number;
  readTime: number;
  sortOrder: number;
}

export interface RtRates {
  shooterCostPerMin: number;
  darkroomCostPerMin: number;
  readerCostPerMin: number;
}

export interface RtViewCalc {
  shooterCost: number;
  darkroomCost: number;
  readerCost: number;
  laborCost: number;
  filmCostPerPart: number;
  pricePerView: number;
}

export interface RtQuoteTotals {
  totalLabor: number;
  totalFilm: number;
  totalPrice: number;
}

export interface RtTierResult extends RtPricingTier {
  filmTotal: number;
  grandTotal: number;
}
