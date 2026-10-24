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
  // The wait below alone can exceed the default 30 s test budget on CI.
  test.setTimeout(90_000);
  const enter = page.getByRole('button', { name: 'Entrer' });
  await expect(enter).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await enter.click();
  await expect(page.locator('#loader')).toBeHidden();
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

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the classic version', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calixte Reymond' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
  });
});
