import { test, expect } from '@playwright/test';
async function login(
  page,
  email = 'admin@devduo.test',
  password = 'DevduoDemo2026!',
  remember = false,
) {
  await page.goto('/login');
  await page.getByLabel('Workspace', { exact: true }).fill('devduo');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (remember) await page.getByLabel('Remember me').check();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('main h1')).toContainText('Hello,');
}
test('remember me restores an expired browser session', async ({ page, context }) => {
  await login(page, undefined, undefined, true);
  const cookies = await context.cookies();
  const remember = cookies.filter((c) => c.name.startsWith('remember_web'));
  expect(remember.length).toBe(1);
  await context.clearCookies();
  await context.addCookies(remember);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Workspace.' })).toBeVisible();
});
test('organization editing and real member access restrictions', async ({ page, browser }) => {
  await login(page);
  const suffix = Date.now();
  const department = `QA department ${suffix}`;
  await page.goto('/organization/departments');
  await page.getByRole('button', { name: 'Add record' }).click();
  await page.getByLabel('Name', { exact: true }).pressSequentially(department, { delay: 5 });
  await page.getByLabel('Code', { exact: true }).fill(`QA-${suffix}`);
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByText(department, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Edit ${department}` }).click();
  await page.getByLabel('Description').fill('Browser-verified organization record');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByText('Browser-verified organization record')).toBeVisible();
  await page.getByRole('button', { name: `Delete ${department}` }).click();
  await page.getByRole('button', { name: 'Delete record' }).click();
  await expect(page.getByText(department, { exact: true })).toHaveCount(0);
  const email = `qa-${suffix}@devduo.test`;
  await page.goto('/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.getByLabel('Full name').fill('QA Member');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Initial password').fill('MemberStrong123!');
  await page.getByLabel('Team member', { exact: true }).check();
  await page.getByRole('button', { name: 'Save user' }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await login(memberPage, email, 'MemberStrong123!');
  await expect(memberPage.getByRole('link', { name: 'People & access' })).toHaveCount(0);
  await memberPage.goto('/users');
  await expect(memberPage.getByText('Access restricted')).toBeVisible();
  const response = await memberPage.request.get('/api/users', {
    headers: { Accept: 'application/json' },
  });
  expect(response.status()).toBe(403);
  await memberContext.close();
  await page.getByRole('row').filter({ hasText: email }).getByRole('button', { name: 'Edit QA Member' }).click();
  await page.getByRole('switch', { name: 'Account active' }).click();
  await page.getByRole('button', { name: 'Save user' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: email }).getByText('Inactive'),
  ).toBeVisible();
});
