import type { GeometryType, UtCustomer, UtDimensions, UtScanResult, UtWeightResult, UtLotResult, UtMaterial, InspectionClass } from './types';

export function rateForGeometry(geo: GeometryType, customer: UtCustomer): number {
  if (geo === 'CSCAN_FLAT' || geo === 'CSCAN_ROUND') return customer.cScanRate;
  if (geo === 'TUBING') return 250;
  return customer.hourlyRate;
}

export function defaultLoadTime(geo: GeometryType): number {
  if (geo === 'RING') return 5;
  if (geo === 'TUBING') return 2;
  return 3;
}

function roundUp1(n: number): number {
  return Math.ceil(n * 10) / 10;
}

export function computeScan(
  geo: GeometryType,
  dims: UtDimensions,
  scanIndex: number,
  loadTime: number,
  hourlyRate: number,
  scanSpeedDivisor: number,
): UtScanResult {
  const minuteRate = hourlyRate / 60;
  let indexes = 0;
  let secPerScanline = 0;
  let scanTimeMin = 0;
  let scanTimeFaceMin = 0;

  switch (geo) {
    case 'FLAT_BAR': {
      // Scan all 4 sides: indexes = (width + thickness) / scanIndex (no ceil — matches Excel)
      indexes = (dims.width + dims.thickness) / scanIndex;
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    }
    case 'CSCAN_FLAT': {
      indexes = Math.ceil(dims.width / scanIndex);
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    }
    case 'THIN_SHEET': {
      indexes = Math.ceil(dims.width / scanIndex);
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    }
    case 'ROUND_BAR':
    case 'CSCAN_ROUND': {
      const circ = Math.PI * dims.diameter;
      indexes = Math.ceil(circ / scanIndex);
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    }
    case 'RING': {
      const wallThickness = (dims.od - dims.id_) / 2;
      const circ = Math.PI * dims.od;
      indexes = Math.ceil(circ / scanIndex);
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      // Face scan: index by wallThickness
      const faceIndexes = Math.ceil((Math.PI * dims.od) / scanIndex);
      const faceSecPerLine = wallThickness / scanSpeedDivisor;
      scanTimeFaceMin = (faceIndexes * faceSecPerLine) / 60;
      break;
    }
    case 'TUBING': {
      const circ = Math.PI * dims.diameter;
      indexes = Math.ceil(circ / scanIndex);
      secPerScanline = dims.length / scanSpeedDivisor;
      scanTimeMin = (indexes * secPerScanline) / 60;
      break;
    }
  }

  let totalTimeMin: number;
  let pricePart: number;

  if (geo === 'RING') {
    totalTimeMin = scanTimeMin + loadTime + scanTimeFaceMin;
    pricePart = roundUp1((totalTimeMin / 60) * hourlyRate);
  } else if (geo === 'THIN_SHEET') {
    totalTimeMin = scanTimeMin + loadTime;
    pricePart = roundUp1(((totalTimeMin) / 60) * hourlyRate * 2);
  } else if (geo === 'TUBING') {
    totalTimeMin = scanTimeMin + loadTime;
    const pricePerScan = roundUp1((totalTimeMin / 60) * hourlyRate);
    pricePart = pricePerScan * dims.numScans;
  } else {
    totalTimeMin = scanTimeMin + loadTime;
    pricePart = roundUp1((totalTimeMin / 60) * hourlyRate);
  }

  return { indexes, secPerScanline, scanTimeMin, scanTimeFaceMin, totalTimeMin, minuteRate, pricePart };
}

export function computeWeight(
  geo: GeometryType,
  dims: UtDimensions,
  material: UtMaterial,
  inspClass: InspectionClass,
): UtWeightResult {
  let cubicInches = 0;
  if (geo === 'FLAT_BAR' || geo === 'CSCAN_FLAT' || geo === 'THIN_SHEET') {
    cubicInches = dims.thickness * dims.width * dims.length;
  } else if (geo === 'ROUND_BAR' || geo === 'CSCAN_ROUND') {
    cubicInches = Math.PI * Math.pow(dims.diameter / 2, 2) * dims.length;
  }
  const weight = cubicInches * material.densityLbPerCuIn;
  const rate = inspClass === 'AA' ? (material.classAARatePerLb ?? material.classARatePerLb ?? 0) : (material.classARatePerLb ?? 0);
  const weightPrice = roundUp1(weight * rate);
  return { cubicInches, weight, weightPrice };
}

export function effectivePrice(scanPrice: number, weightPrice: number, useWeight: boolean): number {
  return useWeight ? Math.max(scanPrice, weightPrice) : scanPrice;
}

export function computeLot(
  pricePart: number,
  qty: number,
  customer: UtCustomer,
  useCScan: boolean,
): UtLotResult {
  const extPrice = roundUp1(pricePart * qty);
  const minCharge = useCScan ? customer.cScanMinCharge : customer.minCharge;
  const lotCharge = customer.lotPattern === 'min_enforced' ? Math.max(extPrice, minCharge) : extPrice;
  const techFee = customer.hasTechFee ? customer.techniqueFee : 0;
  const subTotal = lotCharge + techFee;
  const envFee = customer.hasEnvFee ? roundUp1(subTotal * customer.envFeeRate) : 0;
  const grandTotal = subTotal + envFee;
  return { pricePart, extPrice, lotCharge, techFee, subTotal, envFee, grandTotal };
}
