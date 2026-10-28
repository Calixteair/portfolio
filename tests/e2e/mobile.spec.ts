import { devices, expect, test, type Page } from '@playwright/test';

// A phone held upright: 412 × 839 CSS px, touch, coarse pointer.
const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices['Pixel 7'];
test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

async function leaveLoader(page: Page, name: string) {
  test.setTimeout(180_000);
  const button = page.getByRole('button', { name });
  await expect(button).toBeVisible({ timeout: 120_000 });
  await button.tap();
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
}

/** The page never scrolls sideways. */
async function expectNoSideScroll(page: Page) {
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    innerWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(width);
}

test('the classic version fits a phone', async ({ page }) => {
  await page.goto('/classique/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSideScroll(page);
});

test('the loader outline leaves margins on an upright phone', async ({ page }) => {
  await page.goto('/');
  const wire = await page.locator('#loader .wire').boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(wire).not.toBeNull();
  // The view widens under 4:5 (three/framing.ts): the plate keeps side margins.
  expect(wire?.width ?? width).toBeLessThan(width * 0.6);
  await expectNoSideScroll(page);
});

test('the system opens with the map folded and touch controls @webgpu', async ({ page }) => {
  await page.goto('/');
  await leaveLoader(page, "Passer l'intro");
  await expect(page.locator('#system-ui')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#system-map')).toBeHidden();
  await expect(page.locator('.map-open kbd')).toBeHidden();
  await page.getByRole('button', { name: 'Titres' }).tap();
  await expect(page.locator('#body-titles')).toBeVisible();
  await expectNoSideScroll(page);
});

test('a body opens in a drawer over the lower half @webgpu', async ({ page }) => {
  await page.goto('/#kalidoku');
  await leaveLoader(page, 'Entrer');
  const panel = page.locator('#panel-kalidoku');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // After the slide-in animation.
  await page.waitForTimeout(700);
  const box = await panel.boundingBox();
  const view = page.viewportSize() ?? { width: 0, height: 0 };
  expect(box?.x).toBeCloseTo(0, 0);
  expect(box?.width).toBeCloseTo(view.width, 0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(view.height, 0);
  expect(box?.height ?? view.height).toBeLessThanOrEqual(view.height / 2 + 1);
  await expectNoSideScroll(page);
});
