#!/usr/bin/env node
/**
 * Generate AI-Sentinel investor presentation PDF.
 * Usage: node scripts/gen_pdf.js
 * Requires: npm install puppeteer (in scripts/)
 *
 * Loads live.html via file://, opens the presentation overlay,
 * then uses Chromium's print-to-PDF with @media print CSS applied.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const STATIC_DIR = path.resolve(__dirname, '../crates/ai-sentinel-api/static');
const HTML_FILE = path.join(STATIC_DIR, 'live.html');
const PDF_OUT = path.join(STATIC_DIR, 'presentation.pdf');

(async () => {
  if (!fs.existsSync(HTML_FILE)) {
    console.error('live.html not found at', HTML_FILE);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_PATH,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const fileUrl = 'file:///' + HTML_FILE.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Open presentation overlay and wait for CSS to settle
    await page.evaluate(() => openPresentation());
    await new Promise(r => setTimeout(r, 600));

    const pdf = await page.pdf({
      width: '1280px',
      height: '720px',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    fs.writeFileSync(PDF_OUT, pdf);
    const kb = Math.round(fs.statSync(PDF_OUT).size / 1024);
    console.log(`✓ PDF generated: ${PDF_OUT} (${kb} KB)`);
  } finally {
    await browser.close();
  }
})();
