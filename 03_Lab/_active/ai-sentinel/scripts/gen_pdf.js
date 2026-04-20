#!/usr/bin/env node
/**
 * Generate AI-Sentinel investor presentation PDF.
 * Usage: node scripts/gen_pdf.js
 *
 * Strategy: screenshot each slide at 1280×720, embed into a pdf-lib PDF.
 * This bypasses @media print / position:fixed layout issues in Puppeteer.
 */
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const SLIDE_W = 1280;
const SLIDE_H = 720;
const STATIC_DIR = path.resolve(__dirname, '../crates/ai-sentinel-api/static');
const HTML_FILE  = path.join(STATIC_DIR, 'live.html');
const PDF_OUT    = path.join(STATIC_DIR, 'presentation.pdf');
const TOTAL_SLIDES = 17;

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

  const screenshots = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: SLIDE_W, height: SLIDE_H });

    const fileUrl = 'file:///' + HTML_FILE.split('\\').join('/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Open the presentation overlay
    await page.evaluate(() => openPresentation());
    await new Promise(r => setTimeout(r, 400));

    // Screenshot each slide
    for (let i = 0; i < TOTAL_SLIDES; i++) {
      await page.evaluate((idx) => {
        // Navigate to slide idx using presGo delta from current position
        presIdx = idx;
        presRender();
      }, i);
      // Short wait for CSS transition (0.35s slideIn animation)
      await new Promise(r => setTimeout(r, 400));

      const png = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H },
      });
      screenshots.push(png);
      process.stdout.write(`  slide ${i + 1}/${TOTAL_SLIDES}\r`);
    }
    console.log(`\nAll ${TOTAL_SLIDES} slides captured`);

  } finally {
    await browser.close();
  }

  // Assemble PDF with pdf-lib
  const pdfDoc = await PDFDocument.create();
  // pdf-lib uses points (1pt = 1/72in); 1280×720px @ 96dpi = 960×540pt
  const ptW = (SLIDE_W / 96) * 72;
  const ptH = (SLIDE_H / 96) * 72;

  for (let i = 0; i < screenshots.length; i++) {
    const pngImage = await pdfDoc.embedPng(screenshots[i]);
    const page = pdfDoc.addPage([ptW, ptH]);
    page.drawImage(pngImage, { x: 0, y: 0, width: ptW, height: ptH });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(PDF_OUT, pdfBytes);

  const kb = Math.round(fs.statSync(PDF_OUT).size / 1024);
  const pageCount = pdfDoc.getPageCount();
  console.log(`PDF written: ${PDF_OUT} (${kb} KB, ${pageCount} pages)`);

  if (pageCount !== TOTAL_SLIDES) {
    console.error(`ERROR: expected ${TOTAL_SLIDES} pages, got ${pageCount}`);
    process.exit(1);
  }
  console.log(`✓ Verified: ${pageCount}/${TOTAL_SLIDES} slides`);
})();
