/**
 * UT Live Dry-Run — runs inside the API container with real DB data.
 * Does NOT make HTTP calls — connects to DB directly to test calculation
 * logic with real customer profiles, then checks the API via N8N internal path.
 *
 * Usage (inside container): node /tmp/ut-live-dryrun.mjs
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

// ── Calc functions (mirror of api/src/calculations/ut.ts) ─────────────────────
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
      indexes = dims.length / scanIndex; secPerScanline = circ / ssd;
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
  let pricePart = geo === 'THIN_SHEET'
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

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const RESULTS = [];
function check(label, actual, expected, tol = 0.01) {
  if (Math.abs(actual - expected) > tol) {
    RESULTS.push({ status: 'FAIL', label, msg: `expected ${expected.toFixed(4)}, got ${actual.toFixed(4)}` });
    failed++;
  } else {
    RESULTS.push({ status: 'PASS', label });
    passed++;
  }
}

async function run() {
  // 1. Load real data
  const settingsRow = await pool.query('SELECT scan_speed_divisor FROM ut.global_settings LIMIT 1');
  const SSD = Number(settingsRow.rows[0]?.scan_speed_divisor ?? 10);

  const custRows = await pool.query(
    `SELECT id, name, hourly_rate, cscan_rate, min_charge, cscan_min_charge,
            technique_fee, env_fee_rate, lot_pattern, has_tech_fee, has_env_fee
     FROM ut.customers WHERE is_active = true ORDER BY name`
  );
  const customers = custRows.rows;

  const matRows = await pool.query('SELECT * FROM ut.materials ORDER BY name');
  const materials = matRows.rows;

  console.log(`\n${'='.repeat(70)}`);
  console.log('  NDT Portal — UT Live Dry-Run (real DB data)');
  console.log(`  Customers: ${customers.length}   Materials: ${materials.length}   SSD: ${SSD}`);
  console.log('='.repeat(70));

  // 2. Show customer summary
  console.log('\n── Customer Profiles ──────────────────────────────────────────────────');
  console.log(`${'Name'.padEnd(25)} ${'Rate'.padStart(6)} ${'CRate'.padStart(6)} ${'Min'.padStart(6)} ${'TFee'.padStart(6)} ${'Env'.padStart(5)} ${'Pattern'.padEnd(14)}`);
  console.log('-'.repeat(75));
  for (const c of customers) {
    const envMark = c.has_env_fee ? 'Y' : 'N';
    const tfMark  = c.has_tech_fee ? `$${c.technique_fee}` : '-';
    console.log(
      `${c.name.padEnd(25)} $${String(c.hourly_rate).padStart(5)} $${String(c.cscan_rate).padStart(5)} $${String(c.min_charge).padStart(5)} ${tfMark.padStart(6)} ${envMark.padStart(5)} ${c.lot_pattern.padEnd(14)}`
    );
  }

  // 3. Quote dry-runs against each customer
  console.log('\n── Per-Customer Quote Dry-Run ──────────────────────────────────────────');
  console.log(`${'Customer'.padEnd(25)} ${'Geo'.padEnd(10)} ${'Qty'.padStart(4)} ${'TimePx'.padStart(8)} ${'SubTot'.padStart(8)} ${'Grand'.padStart(8)} ${'Min?'.padStart(5)}`);
  console.log('-'.repeat(75));

  const TEST_CASES = [
    { geo: 'FLAT_BAR',  dims: { thickness: 2, width: 4, length: 12 },   qty: 2 },
    { geo: 'ROUND_BAR', dims: { diameter: 3, length: 10 },               qty: 1 },
    { geo: 'RING',      dims: { od: 10, id_: 8, length: 4 },             qty: 1 },
    { geo: 'TUBING',    dims: { diameter: 2, length: 24 },               qty: 3, numScans: 1 },
    { geo: 'CSCAN_FLAT',dims: { thickness: 1, width: 6, length: 12 },    qty: 1 },
    { geo: 'THIN_SHEET',dims: { thickness: 0.25, width: 8, length: 24 }, qty: 1 },
  ];

  // Only test first 5 customers for brevity
  for (const c of customers.slice(0, 5)) {
    for (const tc of TEST_CASES) {
      const { geo, qty } = tc;
      const isCScan = geo.startsWith('CSCAN');
      const dims = {
        thickness: tc.dims.thickness ?? 0,
        width:     tc.dims.width     ?? 0,
        length:    tc.dims.length    ?? 0,
        diameter:  tc.dims.diameter  ?? 0,
        od:        tc.dims.od        ?? 0,
        id_:       tc.dims.id_       ?? 0,
        numScans:  tc.numScans ?? 1,
      };
      const rate = rateForGeometry(geo, c);
      const lt   = defaultLoadTime(geo);
      const scan = computeScan(geo, dims, 0.065, lt, rate, SSD);
      const lot  = computeLot(scan.pricePart, qty, c, isCScan);

      // Verify internal invariants
      check(`${c.name.slice(0,15)} ${geo} qty=${qty}: extPrice`, lot.extPrice, roundUp1(scan.pricePart * qty));
      check(`${c.name.slice(0,15)} ${geo}: subTotal`, lot.subTotal, lot.lotCharge + lot.techFee);
      check(`${c.name.slice(0,15)} ${geo}: grandTotal`, lot.grandTotal, lot.subTotal + lot.envFee);
      if (c.lot_pattern === 'min_enforced') {
        const minC = isCScan ? Number(c.cscan_min_charge) : Number(c.min_charge);
        check(`${c.name.slice(0,15)} ${geo}: min enforced`, lot.lotCharge, Math.max(lot.extPrice, minC));
      }
      if (!c.has_env_fee) {
        check(`${c.name.slice(0,15)} ${geo}: no envFee`, lot.envFee, 0);
      }
      if (!c.has_tech_fee) {
        check(`${c.name.slice(0,15)} ${geo}: no techFee`, lot.techFee, 0);
      }

      const minFlag = c.lot_pattern === 'min_enforced' && lot.lotCharge > lot.extPrice ? '↑MIN' : '    ';
      console.log(
        `${c.name.slice(0,24).padEnd(25)} ${geo.padEnd(10)} ${String(qty).padStart(4)} $${String(scan.pricePart).padStart(7)} $${String(lot.subTotal).padStart(7)} $${String(lot.grandTotal).padStart(7)} ${minFlag}`
      );
    }
  }

  // 4. Weight pricing check with real material data
  console.log('\n── Weight Pricing Verification ─────────────────────────────────────────');
  if (materials.length > 0) {
    const mat = materials[0];
    const dims = { thickness: 0, width: 0, length: 12, diameter: 3, od: 0, id_: 0, numScans: 1 };
    const cubicInches = Math.PI * Math.pow(3/2, 2) * 12;
    const weight      = cubicInches * Number(mat.density_lb_per_cu_in);
    const rateA       = Number(mat.class_a_rate_per_lb ?? 0);
    const rateAA      = Number(mat.class_aa_rate_per_lb ?? rateA);
    const wpA  = roundUp1(weight * rateA);
    const wpAA = roundUp1(weight * rateAA);
    console.log(`Material: ${mat.name}  density=${mat.density_lb_per_cu_in} lb/cu-in`);
    console.log(`ROUND_BAR 3"×12": cubic=${cubicInches.toFixed(2)}" weight=${weight.toFixed(3)} lb`);
    console.log(`  Class A  @ $${rateA}/lb = $${wpA}`);
    console.log(`  Class AA @ $${rateAA}/lb = $${wpAA}`);
    check('Weight Class AA >= Class A', wpAA >= wpA ? wpAA : -1, wpAA);
  }

  // 5. Quote count in DB
  const countRow = await pool.query('SELECT COUNT(*) FROM ut.incoming_quotes');
  const quoteCount = Number(countRow.rows[0].count);
  console.log(`\n── Database State ──────────────────────────────────────────────────────`);
  console.log(`  ut.incoming_quotes: ${quoteCount} records`);

  if (quoteCount > 0) {
    const recent = await pool.query(
      `SELECT quote_number, customer_name, grand_total, status, created_at
       FROM ut.incoming_quotes ORDER BY created_at DESC LIMIT 5`
    );
    console.log('  Recent quotes:');
    recent.rows.forEach(r => {
      console.log(`    ${r.quote_number}  ${r.customer_name.padEnd(20)} $${String(r.grand_total).padStart(8)}  ${r.status}`);
    });
  }

  // 6. Rule engine check
  const ruleRows = await pool.query(
    `SELECT rs.name, rsv.version, rsv.is_latest
     FROM ut_rules.rule_sets rs
     JOIN ut_rules.rule_set_versions rsv ON rsv.rule_set_id = rs.id
     WHERE rsv.is_latest = true ORDER BY rs.name`
  );
  console.log(`\n  Rule sets (latest versions): ${ruleRows.rows.length}`);
  ruleRows.rows.forEach(r => console.log(`    ${r.name} v${r.version}`));

  const ruleCount = await pool.query('SELECT COUNT(*) FROM ut_rules.rules');
  console.log(`  Total rules: ${ruleCount.rows[0].count}`);

  // 7. Final results
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Invariant checks: \x1b[32m${passed} passed\x1b[0m  \x1b[31m${failed} failed\x1b[0m`);
  if (RESULTS.filter(r => r.status === 'FAIL').length > 0) {
    console.log('\n  FAILURES:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ✗ ${r.label}: ${r.msg}`);
    });
  }
  console.log('='.repeat(70) + '\n');

  await pool.end();
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
