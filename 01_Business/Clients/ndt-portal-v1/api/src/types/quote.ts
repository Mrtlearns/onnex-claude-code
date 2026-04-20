// ============================================================
// UT QUOTE API — INPUT / OUTPUT INTERFACES
// Designed for: Portal UI, Salesforce, Email intake
// ============================================================

export type GeometryType =
  | 'FLAT_BAR'
  | 'ROUND_BAR'
  | 'RING'
  | 'TUBING'
  | 'CSCAN_FLAT'
  | 'CSCAN_ROUND'
  | 'THIN_SHEET'
  | 'SQUARE_RECT_TUBE';

export type InspectionClass = 'A' | 'AA';

export type QuoteSource = 'api' | 'salesforce' | 'email' | 'portal';

// ─── REQUEST ─────────────────────────────────────────────────

/**
 * Top-level quote request — sent by API caller, Salesforce webhook, or email parser.
 */
export interface UtQuoteRequest {
  /** UUID of a known customer in ut.customers. Use this OR customerName. */
  customerId?: string;
  /** Customer name string — used when customerId is unknown (e.g. inbound email). */
  customerName?: string;

  /** One or more parts to price in this quote. */
  items: UtQuoteLineRequest[];

  /** Who/what initiated this request */
  requestedBy?: string;

  /**
   * External system reference:
   *   - Salesforce: Opportunity ID (e.g. "0065g00000AbCdEf")
   *   - Email: Message-ID header value
   *   - Portal: session/user ID
   */
  externalRef?: string;

  /** Origin of the request — determines how response is routed */
  source?: QuoteSource;

  /** Free-form notes (e.g. email body, SF description field) */
  notes?: string;

  /** Inspection standard or specification (e.g. "ASTM A388", "Customer Spec") */
  standard?: string;

  /** Rush level — expedited adds a 25% surcharge to the grand total */
  rushLevel?: 'normal' | 'expedited';

  /** Override rule set version — defaults to customer's assigned version or "default" latest */
  ruleSetVersionId?: string;
}

/**
 * A single line item within a quote request.
 */
export interface UtQuoteLineRequest {
  /** Your internal part number or identifier */
  partNumber?: string;

  /** Human-readable description of the part */
  description?: string;

  /** NDT geometry type — drives which dimensions are required */
  geometryType: GeometryType;

  // ── Dimensions (inches) ──────────────────────────────────
  /** Required for: FLAT_BAR, CSCAN_FLAT, THIN_SHEET */
  thickness?: number;
  /** Required for: FLAT_BAR, CSCAN_FLAT, THIN_SHEET */
  width?: number;
  /** Required for all geometries */
  length?: number;
  /** Required for: ROUND_BAR, CSCAN_ROUND, TUBING */
  diameter?: number;
  /** Required for: RING */
  outerDiameter?: number;
  /** Required for: RING */
  innerDiameter?: number;

  // ── Scan parameters ──────────────────────────────────────
  /**
   * Scan index in inches (step between scan lines).
   * Defaults: 0.065" (standard), 0.125" (coarse), 0.250" (resolution C-scan)
   */
  scanIndex?: number;

  /**
   * Part load/unload time in minutes.
   * Defaults by geometry: RING=5, TUBING=2, all others=3
   */
  loadTime?: number;

  /** Lot quantity (number of pieces) */
  quantity: number;

  /** Number of scan passes — TUBING and SQUARE_RECT_TUBE (default: 1) */
  numberOfScans?: number;

  /** Number of OD scan passes — RING only (default: 1, COULTER FORGE multi-scan variant) */
  numODScans?: number;
  /** Number of face scan passes — RING only (default: 1) */
  numFaceScans?: number;

  // ── Rate override ─────────────────────────────────────────
  /**
   * Override the customer's hourly rate for this line.
   * If omitted, uses customer profile rate (auto-selects C-scan rate for CSCAN geometries).
   */
  hourlyRateOverride?: number;

  // ── Weight-based pricing ──────────────────────────────────
  /**
   * Enable weight pricing: effective price = MAX(time_price, weight_price).
   * Requires materialId + inspectionClass.
   */
  useWeightPricing?: boolean;
  /** UUID from ut.materials */
  materialId?: string;
  /** Inspection class for weight rate lookup */
  inspectionClass?: InspectionClass;
}

// ─── RESPONSE ────────────────────────────────────────────────

/**
 * Full quote response — returned to caller and persisted in ut.incoming_quotes.
 */
export interface UtQuoteResponse {
  /** Internal UUID of the saved quote record */
  quoteId: string;

  /** Auto-generated human-readable number: "UT-2026-1042" */
  quoteNumber: string;

  /** ISO 8601 timestamp */
  generatedAt: string;

  /** Customer snapshot at time of quote */
  customer: UtQuoteCustomerSnapshot;

  /** One result per input line item */
  items: UtQuoteLineResult[];

  /** Roll-up totals across all line items */
  summary: UtQuoteSummary;

  /** Echo back request metadata */
  source: QuoteSource;
  externalRef?: string;
  requestedBy?: string;
  notes?: string;
  standard?: string;
  rushLevel: 'normal' | 'expedited';
}

export interface UtQuoteCustomerSnapshot {
  id: string | null;
  name: string;
  isProspect?: boolean;
  hourlyRate: number;
  cScanRate: number;
  minCharge: number;
  techniqueFee: number;
  hasEnvFee: boolean;
  hasTechFee: boolean;
  lotPattern: string;
  deliveryFee: string;
  leadTime: string;
}

export interface UtQuoteLineResult {
  /** Echo of input part number */
  partNumber?: string;
  description?: string;
  geometryType: GeometryType;

  /** Dimensions used for calculation (echoed from input) */
  dimensions: {
    thickness?: number;
    width?: number;
    length?: number;
    diameter?: number;
    outerDiameter?: number;
    innerDiameter?: number;
    numScans?: number;
  };

  // ── Scan calculation breakdown ───────────────────────────
  scanParameters: {
    scanIndex: number;
    loadTime: number;
    hourlyRate: number;
    indexes: number;
    secPerScanline: number;
    scanTimeMin: number;
    totalTimeMin: number;
  };

  // ── Pricing breakdown ────────────────────────────────────
  pricing: {
    /** Price per part from time-based calculation */
    timePricePart: number;
    /** Price per part from weight calculation (null if not applicable) */
    weightPricePart: number | null;
    /** Final per-part price: MAX(time, weight) if weight pricing enabled */
    effectivePricePart: number;
    quantity: number;
    /** effectivePricePart × quantity */
    extPrice: number;
    /** MAX(extPrice, minCharge) for min_enforced pattern */
    lotCharge: number;
    /** Customer technique fee (0 if customer has no tech fee) */
    techFee: number;
    /** lotCharge + techFee */
    subTotal: number;
    /** subTotal × envFeeRate (0 if customer has no env fee) */
    envFee: number;
    /** Final billed amount for this line */
    grandTotal: number;
  };
}

export interface UtQuoteSummary {
  /** Number of line items */
  itemCount: number;
  /** Sum of all quantities */
  totalParts: number;
  /** Sum of all line grandTotals */
  totalGrand: number;
  /** Sum of all techFees */
  totalTechFees: number;
  /** Sum of all envFees */
  totalEnvFees: number;
  /** Estimated delivery fee (from customer profile) */
  deliveryFee: string;
  /** Lead time (from customer profile) */
  leadTime: string;
  /** Rush level applied to this quote */
  rushLevel: 'normal' | 'expedited';
  /** Rush multiplier applied (1.00 = normal, 1.25 = expedited) */
  rushMultiplier: number;
  /** Rush surcharge amount (totalGrand × 0.25 if expedited, else 0) */
  rushSurcharge: number;
}

// ─── ERROR RESPONSE ──────────────────────────────────────────

export interface UtQuoteError {
  error: string;
  code: 'CUSTOMER_NOT_FOUND' | 'INVALID_GEOMETRY' | 'MISSING_DIMENSIONS' | 'MATERIAL_NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  details?: Record<string, string[]>;
}
