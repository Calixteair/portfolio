import { expect, test } from '@playwright/test';

// No WebGPU and no WebGL at all: the browser cannot run the 3D scene.
test.use({ launchOptions: { args: ['--disable-3d-apis'] } });

test('falls back to the classic version when 3D is unavailable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loader')).toHaveAttribute('data-phase', 'unsupported');
  await expect(page.getByText('Votre navigateur ne peut pas afficher la scène 3D')).toBeVisible();
  await expect(page.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/calixte-reymond/',
  );
});
