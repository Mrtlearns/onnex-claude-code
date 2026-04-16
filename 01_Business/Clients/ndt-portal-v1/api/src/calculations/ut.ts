import type { GeometryType, InspectionClass } from '../types/quote';

export interface DbCustomer {
  id: string; name: string; hourly_rate: number; cscan_rate: number;
  technique_fee: number; env_fee_rate: number; min_charge: number;
  cscan_min_charge: number; delivery_fee: string; lead_time: string;
  has_env_fee: boolean; has_tech_fee: boolean;
  lot_pattern: 'simple' | 'min_enforced';
}

export interface DbMaterial {
  id: string; name: string; density_lb_per_cu_in: number;
  class_a_rate_per_lb: number | null; class_aa_rate_per_lb: number | null;
}

export interface Dims {
  thickness: number; width: number; length: number; diameter: number;
  od: number; id_: number; numScans: number;
}

export interface ScanResult {
  indexes: number; secPerScanline: number; scanTimeMin: number;
  scanTimeFaceMin: number; totalTimeMin: number; pricePart: number;
}

export interface WeightResult {
  cubicInches: number; weight: number; weightPrice: number;
}

function roundUp1(n: number): number {
  return Math.ceil(n * 10) / 10;
}

// Excel uses 3.14 for round bar / tubing circumference (not Math.PI).
// RING calculator uses full pi (3.14159265359). Match the spreadsheet exactly.
const ROUND_PI = 3.14;

export function rateForGeometry(geo: GeometryType, customer: DbCustomer): number {
  if (geo === 'CSCAN_FLAT' || geo === 'CSCAN_ROUND') return Number(customer.cscan_rate);
  if (geo === 'TUBING') return 250;
  return Number(customer.hourly_rate);
}

export function defaultLoadTime(geo: GeometryType): number {
  if (geo === 'RING') return 5;
  if (geo === 'TUBING') return 2;
  return 3;
}

export function computeScan(
  geo: GeometryType, dims: Dims, scanIndex: number,
  loadTime: number, hourlyRate: number, scanSpeedDivisor: number,
): ScanResult {
  let indexes = 0, secPerScanline = 0, scanTimeMin = 0, scanTimeFaceMin = 0;

  switch (geo) {
    case 'FLAT_BAR':
      // Excel: G=(thick+width)/scanIndex — no ceil, scans perimeter
      indexes = (dims.width + dims.thickness) / scanIndex;
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    case 'CSCAN_FLAT': case 'THIN_SHEET':
      // Excel customer sheets: G=(thick+width)/scanIndex — same as flat bar (no ceil)
      indexes = (dims.width + dims.thickness) / scanIndex;
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    case 'ROUND_BAR': case 'CSCAN_ROUND':
      // Excel: F=diameter*3.14, G=F/scanIndex — no ceil, uses 3.14
      indexes = (ROUND_PI * dims.diameter) / scanIndex;
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    case 'RING': {
      // Excel RING CALCULATOR: uses full pi, no ceil
      // OD scan: indexes=length/scanIndex, secPerScanline=circ/10
      // Face scan: faceIndexes=wall/scanIndex, faceSecPerLine=circ/10
      const circ = Math.PI * dims.od;
      indexes = dims.length / scanIndex;
      secPerScanline = circ / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      const wall = (dims.od - dims.id_) / 2;
      const faceIndexes = wall / scanIndex;
      const faceSecPerLine = circ / scanSpeedDivisor;
      scanTimeFaceMin = (faceIndexes * faceSecPerLine) / 60;
      break;
    }
    case 'TUBING':
      // Excel TUBING: circ=diameter*3.14, indexes=circ/scanIndex — no ceil
      indexes = (ROUND_PI * dims.diameter) / scanIndex;
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
  }

  const totalTimeMin = scanTimeMin + loadTime + scanTimeFaceMin;
  let pricePart: number;
  if (geo === 'THIN_SHEET') {
    pricePart = roundUp1((totalTimeMin / 60) * hourlyRate * 2);
  } else if (geo === 'TUBING') {
    pricePart = roundUp1((totalTimeMin / 60) * hourlyRate) * dims.numScans;
  } else {
    pricePart = roundUp1((totalTimeMin / 60) * hourlyRate);
  }
  return { indexes, secPerScanline, scanTimeMin, scanTimeFaceMin, totalTimeMin, pricePart };
}

export function computeWeight(
  geo: GeometryType, dims: Dims, material: DbMaterial, inspClass: InspectionClass,
): WeightResult {
  let cubicInches = 0;
  if (['FLAT_BAR','CSCAN_FLAT','THIN_SHEET'].includes(geo)) {
    cubicInches = dims.thickness * dims.width * dims.length;
  } else if (['ROUND_BAR','CSCAN_ROUND'].includes(geo)) {
    cubicInches = Math.PI * Math.pow(dims.diameter / 2, 2) * dims.length;
  }
  const weight = cubicInches * material.density_lb_per_cu_in;
  const rate = inspClass === 'AA'
    ? (material.class_aa_rate_per_lb ?? material.class_a_rate_per_lb ?? 0)
    : (material.class_a_rate_per_lb ?? 0);
  return { cubicInches, weight, weightPrice: roundUp1(weight * rate) };
}

export function computeLot(
  pricePart: number, qty: number, customer: DbCustomer, isCScan: boolean,
) {
  const extPrice = roundUp1(pricePart * qty);
  const minCharge = isCScan ? Number(customer.cscan_min_charge) : Number(customer.min_charge);
  const lotCharge = customer.lot_pattern === 'min_enforced'
    ? Math.max(extPrice, minCharge) : extPrice;
  const techFee = customer.has_tech_fee ? Number(customer.technique_fee) : 0;
  const subTotal = lotCharge + techFee;
  // Excel: =ROUNDUP(subTotal*envRate, 0) — rounds UP to nearest integer
  const envFee = customer.has_env_fee ? Math.ceil(subTotal * Number(customer.env_fee_rate)) : 0;
  return { extPrice, lotCharge, techFee, subTotal, envFee, grandTotal: subTotal + envFee };
}
