// ============================================================
// RT QUOTE API — INPUT / OUTPUT INTERFACES
// Designed for: Portal UI, Salesforce, Email intake
// ============================================================

export type QuoteSource = 'api' | 'salesforce' | 'email' | 'portal';

export type ShotType = 0 | 1 | 2 | 3;  // 0=none, 1=single, 2=double, 3=triple

// ─── REQUEST ─────────────────────────────────────────────────

/**
 * Top-level RT quote request — sent by API caller, Salesforce webhook, or email parser.
 */
export interface RtQuoteRequest {
  /** Part number being quoted */
  partNumber: string;

  /** Customer name (free text — not linked to a customer table for RT) */
  customerName: string;

  /**
   * Optional: UUID of a specific pricing tier from rt.pricing_tiers.
   * If omitted, all 10 tiers are calculated and returned for comparison.
   * The cheapest tier is flagged as `recommendedTier` in the response.
   */
  pricingTierId?: string;

  /** One view row per RT exposure setup. Max 50. */
  views: RtViewRequest[];

  /** Origin of the request */
  source?: QuoteSource;

  /**
   * External system reference:
   *   - Salesforce: Opportunity ID (e.g. "0065g00000AbCdEf")
   *   - Email: Message-ID header
   *   - Portal: session/user ID
   */
  externalRef?: string;

  /** Who/what submitted the request */
  requestedBy?: string;

  /** Free-form notes */
  notes?: string;
}

/**
 * A single RT view row — one exposure setup for the part.
 */
export interface RtViewRequest {
  /**
   * View sequence number. Auto-assigned (1, 2, 3...) if omitted.
   */
  viewNumber?: number;

  /**
   * Number of shots (exposures) for this view.
   * 0 = none, 1 = single, 2 = double, 3 = triple
   * Rule: shooter cost divides by qty only; darkroom + reader multiply by shotType then divide by qty.
   */
  shotType: ShotType;

  /** Number of parts that fit on a single film sheet */
  qtyPartsPerFilm: number;

  /**
   * Film size — use label (e.g. "7X17") OR id (UUID).
   * Label lookup is case-insensitive. If both provided, id takes precedence.
   */
  filmSizeLabel?: string;
  filmSizeId?: string;

  /** Minutes to unpack and load parts onto the machine */
  unpackLoadTime: number;

  /** Minutes for darkroom processing and film sorting */
  darkroomSortTime: number;

  /** Exposure / shot time in minutes */
  shotTime: number;

  /** Film read and interpretation time in minutes */
  readTime: number;
}

// ─── RESPONSE ────────────────────────────────────────────────

/**
 * Full RT quote response — returned to caller and persisted in rt.incoming_quotes.
 */
export interface RtQuoteResponse {
  /** Internal UUID of the saved quote record */
  quoteId: string;

  /** Auto-generated: "RT-2026-1000" */
  quoteNumber: string;

  /** ISO 8601 timestamp */
  generatedAt: string;

  /** Echo of request identifiers */
  partNumber: string;
  customerName: string;

  /**
   * Crew cost rates computed from current settings + active operators.
   * These are the live rates at the time of the quote — stored in response_body.
   */
  rates: RtRatesSnapshot;

  /** Per-view calculation breakdown */
  views: RtViewResult[];

  /** Totals using the selected (or cheapest) pricing tier */
  totals: RtQuoteTotals;

  /**
   * All 10 pricing tiers compared side-by-side.
   * Useful for showing customer a range of price points.
   */
  tierComparison: RtTierResult[];

  /**
   * The selected tier used for `totals`.
   * If pricingTierId was provided → that tier.
   * If omitted → the tier with the lowest grandTotal.
   */
  selectedTier: RtTierResult;

  source: QuoteSource;
  externalRef?: string;
  requestedBy?: string;
  notes?: string;
}

export interface RtRatesSnapshot {
  /** Cost per minute to run the RT machine (shooter crew) */
  shooterCostPerMin: number;
  /** Cost per minute for darkroom/sort crew */
  darkroomCostPerMin: number;
  /** Cost per minute for film readers */
  readerCostPerMin: number;
}

export interface RtViewResult {
  viewNumber: number;
  shotType: ShotType;
  shotTypeLabel: string;          // "Single", "Double", "Triple", "None"
  qtyPartsPerFilm: number;
  filmSize: {
    label: string;
    widthIn: number;
    heightIn: number;
    sqInches: number;
    costPerSheet: number;
    costPerSheetMarked: number;
  };

  /** Detailed cost breakdown for this view */
  costs: {
    /** Shooter (machine + load) cost per part */
    shooterCost: number;
    /** Darkroom sort cost per part */
    darkroomCost: number;
    /** Reader cost per part */
    readerCost: number;
    /** shooterCost + darkroomCost + readerCost */
    laborCost: number;
    /** Film cost per part at selected tier */
    filmCostPerPart: number;
    /** laborCost + filmCostPerPart */
    pricePerView: number;
  };
}

export interface RtQuoteTotals {
  totalLabor: number;
  totalFilm: number;
  totalPrice: number;
}

export interface RtTierResult {
  tierId: string;
  tierLabel: string;
  singleShotRate: number;
  multiShotRate: number;
  filmTotal: number;
  grandTotal: number;
  /** True for the tier with the lowest grandTotal */
  isRecommended: boolean;
}

// ─── ERROR RESPONSE ──────────────────────────────────────────

export interface RtQuoteError {
  error: string;
  code:
    | 'FILM_SIZE_NOT_FOUND'
    | 'PRICING_TIER_NOT_FOUND'
    | 'NO_ACTIVE_OPERATORS'
    | 'MISSING_SETTINGS'
    | 'VALIDATION_ERROR'
    | 'INTERNAL_ERROR';
  details?: Record<string, string[]>;
}
