// Visual check of the 3D scene on both backends (CLAUDE.md: screenshot before calling a visual change done).
// Usage: node scripts/screenshot.mjs <out-prefix> [url]   (default url: http://localhost:4321/)
// WebGPU needs a real GPU: the browser runs headed (SwiftShader drops the WebGPU device headless).
/* global document -- page.evaluate callbacks run in the browser */
import { chromium } from '@playwright/test';

const [prefix = 'shot', base = 'http://localhost:4321/'] = process.argv.slice(2);
const WAIT_MS = Number(process.env.WAIT_MS ?? 2500);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
});

async function capture(backend) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const url = backend === 'webgl2' ? `${base}?gl=webgl2` : base;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.backend, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(WAIT_MS);
  const active = await page.evaluate(() => document.documentElement.dataset.backend);
  const file = `${prefix}-${backend}.png`;
  await page.screenshot({ path: file });
  console.log(`${backend}: active=${active} → ${file}`);
  if (errors.length) console.log(`  errors:\n  - ${errors.join('\n  - ')}`);
  await page.close();
}

try {
  await capture('webgpu');
  await capture('webgl2');
} finally {
  await browser.close();
}
