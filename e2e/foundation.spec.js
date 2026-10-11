import { test, expect } from '@playwright/test';
const login = async (page) => {
  await page.goto('/login');
  await page.getByLabel('Workspace', { exact: true }).fill('devduo');
  await page.getByLabel('Work email').fill('admin@devduo.test');
  await page.getByLabel('Password', { exact: true }).fill('DevduoDemo2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Workspace.' })).toBeVisible();
};
test('protected routes redirect and login validates required fields', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/login/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Workspace', { exact: true })).toBeFocused();
  await page.getByLabel('Password', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
});
test('real API login, task lifecycle and logout', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'My Work', exact: true }).click();
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  const title = `Browser check ${Date.now()}`;
  await page.getByLabel('Task title').fill(title);
  await page.getByRole('dialog').getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Complete', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Completed', exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Workspace Admin/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/my-work');
  await expect(page).toHaveURL(/login/);
});
for (const width of [1440, 1024, 768, 390])
  test(`responsive navigation and screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    if (width <= 768) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('dialog').getByRole('link', { name: 'People & access' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } else {
      await page.getByRole('link', { name: 'People & access' }).click();
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await page.getByRole('button', { name: 'Expand sidebar' }).click();
    }
    await expect(page.getByRole('heading', { name: 'People & access' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await page.screenshot({ path: `test-results/settings-${width}.png`, fullPage: true });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Hello, Workspace.' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
  });
test('setup wizard saves and resumes progress', async ({ page }) => {
  await login(page);
  await page.goto('/setup');
  const completed = page.getByRole('heading', { name: 'Your company is ready.' });
  if (await completed.isVisible()) return;
  await page.getByTestId('setup-steps').getByRole('button').first().click();
  await page.getByLabel('Company name').fill('Devduo Studio');
  await page.getByRole('button', { name: 'Save progress' }).click();
  await expect(page.getByText('Your progress is saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Company name')).toHaveValue('Devduo Studio');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Legal entity name')).toBeVisible();
});
test('CSRF protection rejects state changes without a token', async ({ request }) => {
  const response = await request.post('/api/login', {
    data: { workspace: 'devduo', email: 'admin@devduo.test', password: 'DevduoDemo2026!' },
    headers: { Accept: 'application/json' },
  });
  expect(response.status()).toBe(419);
});
test('all primary routes render without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  for (const route of [
    '/organization/departments',
    '/roles',
    '/notifications',
    '/audit',
    '/security',
  ]) {
    await page.goto(route);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /load this page/ })).not.toBeVisible();
  }
  expect(errors).toEqual([]);
});
