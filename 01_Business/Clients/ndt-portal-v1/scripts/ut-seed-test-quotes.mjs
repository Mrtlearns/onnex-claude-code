/**
 * UT Test Quote Seeder — inserts representative test quotes for every active customer.
 *
 * Purpose: build production coverage beyond PREMCO so the inbox dashboard,
 *          rule engine, and reporting all have multi-customer data to exercise.
 *
 * Usage (inside API container):
 *   docker cp scripts/ut-seed-test-quotes.mjs ndt-portal-api-1:/app/scripts/
 *   docker exec ndt-portal-api-1 node /app/scripts/ut-seed-test-quotes.mjs
 *
 * Or directly from host (requires DB port mapped, or via SSH + psql):
 *   node scripts/ut-seed-test-quotes.mjs
 *
 * Safe to re-run — inserts only; does not duplicate (checks for existing test source tag).
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PGHOST     || 'postgres',
  port:     Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ndtportal',
  user:     process.env.PGUSER     || 'ndtapp',
  password: process.env.PGPASSWORD,
});

// ── Calc mirrors (same as ut.ts / ut-live-dryrun.mjs) ────────────────────────
const ROUND_PI = 3.14;
function roundUp1(n) { return Math.ceil(n * 10) / 10; }
function rateForGeometry(geo, c) {
  if (geo === 'CSCAN_FLAT' || geo === 'CSCAN_ROUND') return Number(c.cscan_rate);
  if (geo === 'TUBING') return 250;
  return Number(c.hourly_rate);
}
function defaultLoadTime(geo) {
  return geo === 'RING' ? 5 : geo === 'TUBING' ? 2 : 3;
}
function computeScan(geo, dims, scanIndex, loadTime, hourlyRate, ssd) {
  let indexes = 0, secPerScanline = 0, scanTimeMin = 0, scanTimeFaceMin = 0;
  switch (geo) {
    case 'FLAT_BAR': case 'CSCAN_FLAT': case 'THIN_SHEET':
      indexes = (dims.width + dims.thickness) / scanIndex;
      secPerScanline = dims.length / ssd;
      scanTimeMin = (indexes * secPerScanline) / 60; break;
    case 'ROUND_BAR': case 'CSCAN_ROUND':
      indexes = (ROUND_PI * dims.diameter) / scanIndex;
      secPerScanline = dims.length / ssd;
      scanTimeMin = (indexes * secPerScanline) / 60; break;
    case 'RING': {
      const circ = Math.PI * dims.od;
      indexes = dims.length / scanIndex;
      secPerScanline = circ / ssd;
      scanTimeMin = (indexes * secPerScanline) / 60;
      const wall = (dims.od - dims.id_) / 2;
      scanTimeFaceMin = ((wall / scanIndex) * (circ / ssd)) / 60; break;
    }
    case 'TUBING':
      indexes = (ROUND_PI * dims.diameter) / scanIndex;
      secPerScanline = dims.length / ssd;
      scanTimeMin = (indexes * secPerScanline) / 60; break;
  }
  const totalTimeMin = scanTimeMin + loadTime + scanTimeFaceMin;
  const pricePart = geo === 'THIN_SHEET'
    ? roundUp1((totalTimeMin / 60) * hourlyRate * 2)
    : geo === 'TUBING'
      ? roundUp1((totalTimeMin / 60) * hourlyRate) * dims.numScans
      : roundUp1((totalTimeMin / 60) * hourlyRate);
  return { indexes, secPerScanline, scanTimeMin, scanTimeFaceMin, totalTimeMin, pricePart };
}
function computeLot(pricePart, qty, c, isCScan) {
  const extPrice  = roundUp1(pricePart * qty);
  const minCharge = isCScan ? Number(c.cscan_min_charge) : Number(c.min_charge);
  const lotCharge = c.lot_pattern === 'min_enforced' ? Math.max(extPrice, minCharge) : extPrice;
  const techFee   = c.has_tech_fee ? Number(c.technique_fee) : 0;
  const subTotal  = lotCharge + techFee;
  const envFee    = c.has_env_fee ? Math.ceil(subTotal * Number(c.env_fee_rate)) : 0;
  return { extPrice, lotCharge, techFee, subTotal, envFee, grandTotal: subTotal + envFee };
}

// ── One representative test case per geometry type ────────────────────────────
// Chosen to exercise: min_enforced boundary, tech fee, env fee, C-scan, weight-range
const TEST_CASES = [
  {
    geo: 'FLAT_BAR',
    dims: { thickness: 2.5, width: 8, length: 18 },
    qty: 10,
    partNumber: 'TEST-FB-001',
    description: 'Flat bar — standard lot',
    inspectionClass: 'A',
  },
  {
    geo: 'ROUND_BAR',
    dims: { diameter: 4, length: 14 },
    qty: 5,
    partNumber: 'TEST-RB-001',
    description: 'Round bar — mid-size',
    inspectionClass: 'A',
  },
  {
    geo: 'RING',
    dims: { od: 12, id_: 10, length: 6 },
    qty: 3,
    partNumber: 'TEST-RG-001',
    description: 'Ring — face scan included',
    inspectionClass: 'A',
  },
  {
    geo: 'TUBING',
    dims: { diameter: 2, length: 30, numScans: 2 },
    qty: 4,
    partNumber: 'TEST-TU-001',
    description: 'Tubing — 2 scans',
    inspectionClass: 'A',
  },
  {
    geo: 'CSCAN_FLAT',
    dims: { thickness: 1.5, width: 6, length: 10 },
    qty: 1,
    partNumber: 'TEST-CF-001',
    description: 'C-scan flat — cscan rate',
    inspectionClass: 'A',
  },
  {
    geo: 'THIN_SHEET',
    dims: { thickness: 0.25, width: 10, length: 30 },
    qty: 2,
    partNumber: 'TEST-TS-001',
    description: 'Thin sheet — 2× multiplier',
    inspectionClass: 'A',
  },
];

// ── Request/response body builders ───────────────────────────────────────────
function buildRequestBody(tc, customerName) {
  const dimFields = {};
  const g = tc.geo;
  if (g === 'FLAT_BAR' || g === 'CSCAN_FLAT' || g === 'THIN_SHEET') {
    dimFields.thickness = tc.dims.thickness;
    dimFields.width     = tc.dims.width;
    dimFields.length    = tc.dims.length;
  } else if (g === 'ROUND_BAR' || g === 'CSCAN_ROUND') {
    dimFields.diameter = tc.dims.diameter;
    dimFields.length   = tc.dims.length;
  } else if (g === 'RING') {
    dimFields.outerDiameter = tc.dims.od;
    dimFields.innerDiameter = tc.dims.id_;
    dimFields.length        = tc.dims.length;
  } else if (g === 'TUBING') {
    dimFields.diameter      = tc.dims.diameter;
    dimFields.length        = tc.dims.length;
    dimFields.numberOfScans = tc.dims.numScans ?? 1;
  }
  return {
    customerName,
    source: 'api',
    requestedBy: 'seed-script',
    items: [{
      geometryType:     tc.geo,
      partNumber:       tc.partNumber,
      description:      tc.description,
      quantity:         tc.qty,
      scanIndex:        0.065,
      loadTime:         defaultLoadTime(tc.geo),
      inspectionClass:  tc.inspectionClass,
      useWeightPricing: false,
      numberOfScans:    tc.dims.numScans ?? 1,
      ...dimFields,
    }],
  };
}

function buildResponseBody(tc, c, scan, lot) {
  const dimOut = {};
  const g = tc.geo;
  if (g === 'FLAT_BAR' || g === 'CSCAN_FLAT' || g === 'THIN_SHEET') {
    dimOut.thickness = tc.dims.thickness; dimOut.width = tc.dims.width; dimOut.length = tc.dims.length;
  } else if (g === 'ROUND_BAR' || g === 'CSCAN_ROUND') {
    dimOut.diameter = tc.dims.diameter; dimOut.length = tc.dims.length;
  } else if (g === 'RING') {
    dimOut.outerDiameter = tc.dims.od; dimOut.innerDiameter = tc.dims.id_; dimOut.length = tc.dims.length;
  } else if (g === 'TUBING') {
    dimOut.diameter = tc.dims.diameter; dimOut.length = tc.dims.length;
  }
  return {
    items: [{
      geometryType: tc.geo,
      partNumber:   tc.partNumber,
      description:  tc.description,
      dimensions:   dimOut,
      scanParameters: {
        scanIndex:    0.065,
        loadTime:     defaultLoadTime(tc.geo),
        hourlyRate:   String(rateForGeometry(tc.geo, c)),
        indexes:      Math.round(scan.indexes * 10000) / 10000,
        secPerScanline: Math.round(scan.secPerScanline * 10000) / 10000,
        scanTimeMin:  Math.round(scan.scanTimeMin * 10000) / 10000,
        totalTimeMin: Math.round(scan.totalTimeMin * 10000) / 10000,
      },
      pricing: {
        quantity:         tc.qty,
        timePricePart:    scan.pricePart,
        weightPricePart:  null,
        effectivePricePart: scan.pricePart,
        extPrice:         lot.extPrice,
        lotCharge:        lot.lotCharge,
        techFee:          lot.techFee,
        subTotal:         lot.subTotal,
        envFee:           lot.envFee,
        grandTotal:       lot.grandTotal,
      },
    }],
    summary: {
      itemCount:     1,
      totalParts:    tc.qty,
      totalTechFees: lot.techFee,
      totalEnvFees:  lot.envFee,
      totalGrand:    lot.grandTotal,
      leadTime:      '4-5 Days',
      deliveryFee:   'No',
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const settingsRow = await pool.query('SELECT scan_speed_divisor FROM ut.global_settings LIMIT 1');
  const SSD = Number(settingsRow.rows[0]?.scan_speed_divisor ?? 10);

  const custRows = await pool.query(
    `SELECT id, name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
            technique_fee, env_fee_rate, lot_pattern, has_tech_fee, has_env_fee
     FROM ut.customers WHERE is_active = true ORDER BY name`
  );
  const customers = custRows.rows;

  // Skip PREMCO — already has 50+ real quotes
  const targets = customers.filter(c => c.name !== 'PREMCO');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  UT Test Quote Seeder — ${targets.length} customers × ${TEST_CASES.length} geometries`);
  console.log(`  SSD: ${SSD}   Total inserts planned: ${targets.length * TEST_CASES.length}`);
  console.log('='.repeat(70));

  // Check if already seeded (avoid duplicates)
  const existingCheck = await pool.query(
    `SELECT customer_name FROM ut.incoming_quotes WHERE requested_by = 'seed-script' LIMIT 1`
  );
  if (existingCheck.rows.length > 0) {
    console.log('\n  [INFO] Seed data already present (requested_by = seed-script).');
    console.log('  To re-seed, first run:');
    console.log(`    DELETE FROM ut.incoming_quotes WHERE requested_by = 'seed-script';`);
    console.log('  Then re-run this script.\n');
    await pool.end();
    return;
  }

  let inserted = 0, errors = 0;

  for (const c of targets) {
    for (const tc of TEST_CASES) {
      const isCScan = tc.geo.startsWith('CSCAN');
      const dims = {
        thickness: tc.dims.thickness ?? 0,
        width:     tc.dims.width     ?? 0,
        length:    tc.dims.length    ?? 0,
        diameter:  tc.dims.diameter  ?? 0,
        od:        tc.dims.od        ?? 0,
        id_:       tc.dims.id_       ?? 0,
        numScans:  tc.dims.numScans  ?? 1,
      };
      const rate = rateForGeometry(tc.geo, c);
      const lt   = defaultLoadTime(tc.geo);
      const scan = computeScan(tc.geo, dims, 0.065, lt, rate, SSD);
      const lot  = computeLot(scan.pricePart, tc.qty, c, isCScan);

      const reqBody  = buildRequestBody(tc, c.name);
      const respBody = buildResponseBody(tc, c, scan, lot);

      try {
        await pool.query(
          `INSERT INTO ut.incoming_quotes
             (source, requested_by, customer_id, customer_name, status,
              request_body, response_body, grand_total)
           VALUES ('api', 'seed-script', $1, $2, 'calculated', $3, $4, $5)`,
          [c.id, c.name, JSON.stringify(reqBody), JSON.stringify(respBody), lot.grandTotal]
        );
        inserted++;
      } catch (err) {
        console.error(`  ERROR: ${c.name} ${tc.geo}: ${err.message}`);
        errors++;
      }
    }
    process.stdout.write(`  ✓ ${c.name.padEnd(25)} — ${TEST_CASES.length} quotes inserted\n`);
  }

  // Final summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Inserted: ${inserted}   Errors: ${errors}`);

  const totalRow = await pool.query('SELECT COUNT(*) FROM ut.incoming_quotes');
  const seedRow  = await pool.query(`SELECT COUNT(*) FROM ut.incoming_quotes WHERE requested_by = 'seed-script'`);
  console.log(`  Total quotes in DB: ${totalRow.rows[0].count}  (seed-script: ${seedRow.rows[0].count})`);
  console.log('='.repeat(70) + '\n');

  await pool.end();
  if (errors > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
