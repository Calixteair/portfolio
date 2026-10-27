import { expect, test, type Page } from '@playwright/test';

/** Collects uncaught page errors and CSP violations so each test can assert there were none. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      errors.push(message.text());
    }
  });
  return errors;
}

/**
 * Loader → "Entrer" → scene. The shaders are precompiled before "Entrer" appears: under
 * SwiftShader (CPU-emulated GPU in CI) that alone takes several seconds, hence the timeout.
 */
async function enterScene(page: Page) {
  // SwiftShader compiles the forge's render and compute shaders on the CPU: the wait below
  // takes ~35 s locally, more on CI, far beyond the default 30 s test budget.
  test.setTimeout(180_000);
  const enter = page.getByRole('button', { name: 'Entrer' });
  await expect(enter).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await enter.click();
  // 1.6 s fade, but under SwiftShader each frame can take seconds (CI): be patient.
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('canvas')).toBeVisible();
}

test('loads, then enters the scene on the forced WebGL 2 backend', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/?gl=webgl2');
  await enterScene(page);
  await expect(page.locator('html')).toHaveAttribute('data-backend', 'webgl2');
  expect(errors).toEqual([]);
});

test('loads, then enters the scene on WebGPU @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');
  await enterScene(page);
  await expect(page.locator('html')).toHaveAttribute('data-backend', 'webgpu');
  expect(errors).toEqual([]);
});

/** Clicks the lower band of the plate (below the hole) until `done` or `max` clicks. */
async function strikePendant(page: Page, done: (state: string) => boolean, max: number) {
  const size = page.viewportSize() ?? { width: 1280, height: 720 };
  let state = '';
  for (let i = 0; i < max && !done(state); i++) {
    await page.mouse.click(size.width * 0.47, size.height * 0.69);
    await page.waitForTimeout(60);
    state = (await page.locator('html').getAttribute('data-state')) ?? '';
  }
  return state;
}

// Overheating needs real time (cumulated turns at a capped time step): headless SwiftShader
// is far too slow, so CI checks the first state change; the full path runs on a real GPU.
test('a click on the pendant starts heating it', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/?gl=webgl2');
  await enterScene(page);
  expect(await strikePendant(page, (s) => s === 'heating', 20)).toBe('heating');
  expect(errors).toEqual([]);
});

test('repeated clicks overheat the pendant @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');
  await enterScene(page);
  const state = await strikePendant(page, (s) => s === 'overheated' || s === 'portalOpen', 120);
  expect(['overheated', 'portalOpen']).toContain(state);
  expect(errors).toEqual([]);
});

test('the overheated pendant opens the portal @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');
  await enterScene(page);
  expect(await strikePendant(page, (s) => s === 'portalOpen', 200)).toBe('portalOpen');
  await expect(page.locator('html')).toHaveAttribute('data-portal', 'open', { timeout: 10_000 });
  expect(errors).toEqual([]);
});

/** From the forge to the open portal, by keyboard (Space strikes), then Enter dives in. */
async function diveThroughPortal(page: Page) {
  await page.goto('/');
  await enterScene(page);
  const strikeBySpace = async () => {
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    return (await page.locator('html').getAttribute('data-state')) ?? '';
  };
  let state = '';
  for (let i = 0; i < 200 && state !== 'portalOpen'; i++) state = await strikeBySpace();
  await expect(page.locator('html')).toHaveAttribute('data-portal', 'open', { timeout: 10_000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-state', 'portfolio', {
    timeout: 10_000,
  });
}

test('dives through the portal into the planetary system @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await diveThroughPortal(page);
  expect(errors).toEqual([]);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('fades into the planetary system instead of flying @webgpu', async ({ page }) => {
    const errors = trackPageErrors(page);
    const start = Date.now();
    await diveThroughPortal(page);
    expect(errors).toEqual([]);
    expect(Date.now() - start).toBeLessThan(60_000);
  });
});

test('travels to a body from the keyboard list, then back @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await diveThroughPortal(page);
  await page.locator('nav.system-nav a[data-body="vps"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-vps')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#panel-title-vps')).toBeFocused();
  expect(page.url()).toContain('#vps');
  await page.locator('#panel-vps a[data-body="skill-docker"]').click();
  await expect(page.locator('#panel-skill-docker')).toBeVisible({ timeout: 10_000 });
  await page.goBack();
  await expect(page.locator('#panel-vps')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-panel]:not([hidden])')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the classic version', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calixte Reymond' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
  });

  test('ships every panel as static HTML (indexable)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-panel]')).toHaveCount(39);
    await expect(page.locator('#panel-title-ratp')).toHaveText('RATP : alternance cybersécurité');
  });
});

/** Loader → a button → wait until the loader is gone (same patience as enterScene). */
async function leaveLoader(page: Page, name: string) {
  test.setTimeout(180_000);
  const button = page.getByRole('button', { name });
  await expect(button).toBeVisible({ timeout: 120_000 });
  await button.click();
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
}

test('"Passer l\'intro" goes straight to the planetary system @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');
  await leaveLoader(page, "Passer l'intro");
  await expect(page.locator('html')).toHaveAttribute('data-state', 'portfolio', {
    timeout: 10_000,
  });
  await expect(page.locator('#system-ui')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a shared link to a body skips the intro and opens it @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/#kalidoku');
  await leaveLoader(page, 'Entrer');
  await expect(page.locator('#panel-kalidoku')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
