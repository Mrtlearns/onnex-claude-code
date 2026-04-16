const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let intakeId = null;
  page.on('response', async resp => {
    if (resp.url().includes('/pipeline/analyze')) {
      try { const b = await resp.json(); if (b.intakeId) { intakeId = b.intakeId; console.log('intakeId:', intakeId); } } catch(e) {}
    }
  });

  await page.goto('http://10.10.110.32:8888');
  await page.waitForLoadState('networkidle');

  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    const msgFile = path.resolve(__dirname, '250706 RT.msg');
    console.log('Uploading:', msgFile);
    await fileInput.setInputFiles(msgFile);
    console.log('File uploaded');
  } else {
    console.log('ERROR: No file input found');
    await browser.close(); return;
  }

  // Wait up to 40s for intakeId
  for (let i = 0; i < 40 && !intakeId; i++) { await page.waitForTimeout(1000); }

  if (intakeId) fs.writeFileSync(path.resolve(__dirname, 'last_intake_id.txt'), intakeId);
  console.log('Final intakeId:', intakeId);
  await browser.close();
})();
