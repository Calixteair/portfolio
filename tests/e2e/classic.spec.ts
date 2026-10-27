import { expect, test } from '@playwright/test';

test.describe('classic version', () => {
  test('shows the whole portfolio without the 3D island', async ({ page }) => {
    await page.goto('/classique/');
    await expect(page.getByRole('heading', { level: 1, name: 'Calixte Reymond' })).toBeVisible();
    await expect(page.locator('article.entry')).toHaveCount(39);
    await expect(page.locator('astro-island')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('links entries to each other on the page', async ({ page }) => {
    await page.goto('/classique/');
    await page.locator('#kalidoku').getByRole('link', { name: 'Rust' }).click();
    await expect(page).toHaveURL(/#skill-rust$/);
    await expect(page.locator('#title-skill-rust')).toBeInViewport();
  });

  test('is reachable from the loader', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Version classique' }).click();
    await expect(page).toHaveURL(/\/classique\/$/);
  });

  test('declares the home page as canonical, with a share image', async ({ page }) => {
    await page.goto('/classique/');
    const head = page.locator('head');
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://portfolio.calixteair.fr/',
    );
    await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://portfolio.calixteair.fr/og.jpg',
    );
    const image = await page.request.get('/og.jpg');
    expect(image.headers()['content-type']).toBe('image/jpeg');
  });
});
