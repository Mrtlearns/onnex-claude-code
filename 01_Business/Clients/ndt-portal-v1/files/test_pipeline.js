const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept network to capture intakeId
  let intakeId = null;
  page.on('response', async resp => {
    if (resp.url().includes('/pipeline/analyze')) {
      try {
        const body = await resp.json();
        if (body.intakeId) {
          intakeId = body.intakeId;
          console.log('GOT INTAKE ID:', intakeId);
        }
      } catch(e) {}
    }
  });

  await page.goto('http://10.10.110.32:8888');
  await page.waitForLoadState('networkidle');

  // Take initial screenshot
  await page.screenshot({ path: 'files/test_01_loaded.png' });
  console.log('Dashboard loaded');

  // Find file input
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    console.log('No file input found, looking for drop zone...');
    const html = await page.content();
    const match = html.match(/input.*type.*file/i);
    console.log('File input HTML match:', match ? match[0] : 'none');
    // Try to find and click upload trigger
    const dropzone = await page.$('[class*="drop"], [class*="upload"], [class*="msg"]');
    if (dropzone) {
      console.log('Found dropzone:', await dropzone.getAttribute('class'));
    }
  } else {
    await fileInput.setInputFiles('D:\\Code\\gitlab.botonomy.xyz\\claude-workspace-pro\\projects\\ndt-portal-v1\\files\\250706 RT.msg');
    console.log('File uploaded');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'files/test_02_after_upload.png' });

  // Wait up to 30s for intakeId
  let waited = 0;
  while (!intakeId && waited < 30000) {
    await page.waitForTimeout(1000);
    waited += 1000;
  }

  console.log('Final intakeId:', intakeId);
  await page.screenshot({ path: 'files/test_03_pipeline_started.png' });

  if (intakeId) {
    fs.writeFileSync('files/last_intake_id.txt', intakeId);
    console.log('Saved intakeId to files/last_intake_id.txt');
  }

  await browser.close();
})();
