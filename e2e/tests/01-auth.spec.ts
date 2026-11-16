import { test, expect } from '@playwright/test';
import { login, USERS, isNarrow } from './helpers';

test.describe('Sign-in and access control', () => {
  test('wrong password shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-id').fill(USERS.admin.email);
    await page.locator('#login-password').fill('not-the-password');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toContainText(/invalid credentials/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('password can be shown and hidden', async ({ page }) => {
    await page.goto('/login');
    const pw = page.locator('#login-password');
    await pw.fill('secret');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
  });

  test('admin signs in to the dashboard and signs out', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    if (isNarrow(page)) await page.getByTestId('open-menu').click();
    await page.getByTestId('logout').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    // the old session is revoked: going back does not show the app
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('employee lands on the self-service portal', async ({ page }) => {
    await login(page, 'employee');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/portal/i);
  });

  test('employee cannot open staff pages', async ({ page }) => {
    await login(page, 'employee');
    for (const path of ['/assets', '/employees', '/reports', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/portal\/my-assets$/);
    }
  });

  test('signed-out visitors are sent to the login page', async ({ page }) => {
    await page.goto('/assets');
    await expect(page).toHaveURL(/\/login$/);
  });
});
