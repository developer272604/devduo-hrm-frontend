import { test, expect } from '@playwright/test';

test('brand color, persistent theme, and themed keyboard dropdowns', async ({ page }) => {
  await page.goto('/login');
  const darkToggle = page.getByRole('button', { name: 'Switch to dark mode' });
  if (!(await darkToggle.isVisible()))
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCSS(
    'background-color',
    'rgb(124, 70, 241)',
  );
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await page.getByLabel('Workspace', { exact: true }).fill('devduo');
  await page.getByLabel('Work email').fill('admin@devduo.test');
  await page.getByLabel('Password', { exact: true }).fill('DevduoDemo2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Workspace.' })).toBeVisible();
  await page.goto('/settings');
  const timezone = page.getByRole('combobox', { name: /Timezone/ });
  await timezone.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await timezone.press('Home');
  await timezone.press('ArrowDown');
  await timezone.press('Enter');
  await expect(timezone).toContainText('UTC');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await timezone.click();
  await timezone.press('Escape');
  await expect(timezone).toBeFocused();
  await expect(page.locator('[style]')).toHaveCount(0);
  expect(await page.locator('link[rel="stylesheet"][href^="https://"]').count()).toBe(0);
  await page.screenshot({ path: 'test-results/settings-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await timezone.click();
  await page.screenshot({ path: 'test-results/dropdown-light.png', fullPage: true });
});
