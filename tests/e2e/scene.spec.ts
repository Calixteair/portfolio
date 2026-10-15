import { expect, test, type Page } from '@playwright/test';

/** Collects uncaught page errors so each test can assert there were none. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('renders the scene on the forced WebGL 2 backend', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/?gl=webgl2');

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-backend', 'webgl2');
  expect(errors).toEqual([]);
});

test('renders the scene on WebGPU @webgpu', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-backend', 'webgpu');
  expect(errors).toEqual([]);
});
