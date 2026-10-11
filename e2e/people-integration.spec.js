import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Workspace', { exact: true }).fill('devduo');
  await page.getByLabel('Work email').fill('admin@devduo.test');
  await page.getByLabel('Password', { exact: true }).fill('DevduoDemo2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Workspace.' })).toBeVisible();
}

test('existing insight and employee links reach live People screens', async ({ page }) => {
  await login(page);
  const response = await page.request.get('/api/v1/employees?q=Workspace');
  expect(response.ok()).toBeTruthy();
  const employee = (await response.json()).data.find(row => row.employee_number === 'DD-DEMO-001');
  expect(employee).toBeTruthy();
  await page.goto(`/employees/${employee.uuid}`);
  await expect(page).toHaveURL(`/people/${employee.uuid}`);
  await expect(page.getByRole('heading', { name: 'Workspace Admin', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identity & position' })).toBeVisible();
  await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await expect(page.getByText(/Joined the company on/)).toBeVisible();
  await page.getByRole('tab', { name: 'Organization memory' }).click();
  await expect(page.getByLabel('Organization as of')).toBeVisible();
  await page.goto('/employees?insight=people.without_manager');
  await expect(page).toHaveURL('/people?insight=people.without_manager');
  await expect(page.getByRole('heading', { name: 'Employees needing attention' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Records' })).toContainText('Workspace Admin');
});

test('People operations and attendance load from the real API', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page);
  for (const [route, heading] of [['/people/action-center','People action center'],['/people/quality','People data quality'],['/people/org-chart','Organization chart'],['/people/import-export','Import and export'],['/attendance','My attendance'],['/time-office/daily','Daily attendance']]) {
    await page.goto(route);
    await expect(page.getByRole('heading', {name:heading,exact:true})).toBeVisible();
    await expect(page.getByRole('status', {name:'Loading'})).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('People mobile view has no overflow or inline styling in dark mode', async ({ page }) => {
  await login(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/people');
  await expect(page.getByRole('list', {name:'Records'})).toContainText('Workspace Admin');
  const width = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,width:innerWidth,inline:document.querySelectorAll('[style]').length}));
  expect(width.scroll).toBeLessThanOrEqual(width.width);
  expect(width.inline).toBe(0);
  await page.screenshot({path:'../docs/screenshots/people-mobile.png',fullPage:true});
});
