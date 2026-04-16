export interface UtSettings {
  id: string;
  defaultHourlyRate: number;
  cScanHourlyRate: number;
  highResHourlyRate: number;
  defaultEnvFeeRate: number;
  defaultTechniqueFee: number;
  defaultMinCharge: number;
  defaultLoadTime: number;
  scanSpeedDivisor: number;
  defaultLeadTime: string;
}

export type GeometryType = 'FLAT_BAR' | 'ROUND_BAR' | 'RING' | 'TUBING' | 'CSCAN_FLAT' | 'CSCAN_ROUND' | 'THIN_SHEET';
export type LotPattern = 'simple' | 'min_enforced';
export type InspectionClass = 'A' | 'AA';

export interface UtCustomer {
  id: string;
  name: string;
  hourlyRate: number;
  cScanRate: number;
  techniqueFee: number;
  envFeeRate: number;
  minCharge: number;
  cScanMinCharge: number;
  deliveryFee: string;
  leadTime: string;
  hasEnvFee: boolean;
  hasTechFee: boolean;
  lotPattern: LotPattern;
  notes: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UtMaterial {
  id: string;
  name: string;
  densityLbPerCuIn: number;
  classARatePerLb: number | null;
  classAARatePerLb: number | null;
  sortOrder: number;
}

export interface UtDimensions {
  thickness: number;
  width: number;
  length: number;
  diameter: number;
  od: number;
  id_: number;
  numScans: number;
}

export interface UtScanResult {
  indexes: number;
  secPerScanline: number;
  scanTimeMin: number;
  scanTimeFaceMin: number;
  totalTimeMin: number;
  minuteRate: number;
  pricePart: number;
}

export interface UtWeightResult {
  cubicInches: number;
  weight: number;
  weightPrice: number;
}

export interface UtLotResult {
  pricePart: number;
  extPrice: number;
  lotCharge: number;
  techFee: number;
  subTotal: number;
  envFee: number;
  grandTotal: number;
}

export type RushLevel = 'normal' | 'expedited';

export interface UtQuote {
  id: string;
  customerId: string;
  quoteNumber: string;
  quotedBy: string;
  createdAt: string;
  standard?: string;
  rushLevel?: RushLevel;
}

export interface UtLineItem {
  id: string;
  quoteId: string;
  geometryType: GeometryType;
  thickness: number | null;
  width: number | null;
  length: number | null;
  diameter: number | null;
  outerDiameter: number | null;
  innerDiameter: number | null;
  scanIndex: number;
  loadTime: number;
  hourlyRate: number;
  quantity: number;
  numberOfScans: number;
  materialId: string | null;
  inspectionClass: InspectionClass | null;
  useWeightPricing: boolean;
  sortOrder: number;
}
