const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  const outputDir = path.join(__dirname, '..', 'docs', 'images');
  const tempFramesDir = path.join(__dirname, '..', 'docs', 'temp_frames');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(tempFramesDir)) fs.mkdirSync(tempFramesDir, { recursive: true });

  console.log('[Capture] Launching Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });

  const frames = [];
  let frameIndex = 0;

  async function recordFrame(delayMs = 600) {
    const framePath = path.join(tempFramesDir, `frame_${String(frameIndex++).padStart(3, '0')}.png`);
    await page.screenshot({ path: framePath });
    frames.push(framePath);
    if (delayMs > 0) await sleep(delayMs);
  }

  console.log('[Capture] Navigating to http://localhost:8081/?page=demo ...');
  await page.goto('http://localhost:8081/?page=demo', { waitUntil: 'networkidle0' });
  await sleep(1000);

  // 1. Capture Public Status Page
  console.log('[Capture] Capturing public-status.png...');
  const publicStatusPath = path.join(outputDir, 'public-status.png');
  await page.screenshot({ path: publicStatusPath });
  await recordFrame(800);

  // Hover over one of the uptime pills on the first component
  console.log('[Capture] Hovering on uptime history pill...');
  const pills = await page.$$('div[title*="UTC"]');
  if (pills && pills.length > 0) {
    await pills[Math.floor(pills.length / 2)].hover();
    await sleep(400);
    await recordFrame(800);
  }

  // 2. Open Subscribe Modal
  console.log('[Capture] Opening Subscribe modal...');
  const getAlertsBtn = await page.$('button::-p-text(Get Alerts)');
  if (getAlertsBtn) {
    await getAlertsBtn.click();
    await sleep(700);
    const subscribePath = path.join(outputDir, 'subscribe-modal.png');
    await page.screenshot({ path: subscribePath });
    await recordFrame(1000);

    // Close Subscribe Modal via aria-label
    const closeBtn = await page.$('button[aria-label="Close"]');
    if (closeBtn) {
      await closeBtn.click();
      await sleep(500);
    }
  }

  // 3. Switch to Admin Cockpit
  console.log('[Capture] Switching to Admin Cockpit...');
  const adminBtn = await page.$('button::-p-text(Admin Cockpit)');
  if (adminBtn) {
    await adminBtn.click();
    await sleep(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);

    const adminPath = path.join(outputDir, 'admin-cockpit.png');
    await page.screenshot({ path: adminPath });
    await recordFrame(1000);

    // Scroll down slightly to show incident history
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(500);
    await recordFrame(800);

    // 4. Open Post-Mortem modal
    console.log('[Capture] Opening Post-Mortem modal...');
    const postMortemBtn = await page.$('button::-p-text(Generate Post-Mortem)');
    if (postMortemBtn) {
      await postMortemBtn.click();
      await sleep(1000);

      const postMortemPath = path.join(outputDir, 'post-mortem-modal.png');
      await page.screenshot({ path: postMortemPath });
      await recordFrame(1200);

      // Close post mortem modal via aria-label or Close button
      const closePmBtn = await page.$('button[aria-label="Close"], button::-p-text(Close)');
      if (closePmBtn) {
        await closePmBtn.click();
        await sleep(500);
      }
    }
  }

  // Back to top of public view
  const publicBtn = await page.$('button::-p-text(Public View)');
  if (publicBtn) {
    await publicBtn.click();
    await sleep(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(400);
    await recordFrame(800);
  }

  await browser.close();
  console.log(`[Capture] Captured ${frames.length} frames.`);

  // Compile animated GIF using ffmpeg
  const gifPath = path.join(outputDir, 'statuscast-demo.gif');
  console.log('[Capture] Compiling animated GIF with ffmpeg...');
  const ffmpegCmd = `ffmpeg -y -framerate 1.5 -i "${path.join(tempFramesDir, 'frame_%03d.png')}" -filter_complex "[0:v] scale=960:-1:flags=lanczos,split [a][b];[a] palettegen=max_colors=128:reserve_transparent=0 [p];[b][p] paletteuse=dither=bayer:bayer_scale=3" "${gifPath}"`;

  try {
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`✓ Successfully generated ${gifPath}`);
  } catch (err) {
    console.error('Failed to compile GIF with ffmpeg:', err.message);
  } finally {
    // Clean up temporary frames
    try {
      const files = fs.readdirSync(tempFramesDir);
      for (const f of files) {
        fs.unlinkSync(path.join(tempFramesDir, f));
      }
      fs.rmdirSync(tempFramesDir);
      console.log('✓ Cleaned up temporary frames.');
    } catch {}
  }
}

capture().catch((err) => {
  console.error('[Capture] Fatal error:', err);
  process.exit(1);
});
