const path = require('node:path');
const puppeteer = require('puppeteer');

async function testMobile() {
  const outputDir = path.join(__dirname, '..', 'docs', 'images');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  // Standard Telegram Mini App mobile viewport: 390x844 (iPhone 14)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  console.log('[Mobile] Loading public status page on 390px mobile viewport...');
  await page.goto('http://localhost:8081/?page=demo', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(outputDir, 'mobile-public.png') });
  console.log('✓ Captured mobile-public.png');

  // Navigate to Admin Cockpit
  const adminBtn = await page.$('button::-p-text(Admin Cockpit)');
  if (adminBtn) {
    await adminBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outputDir, 'mobile-admin.png') });
    console.log('✓ Captured mobile-admin.png');
  }

  await browser.close();
}

testMobile().catch(console.error);
