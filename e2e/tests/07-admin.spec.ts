import { test, expect } from '@playwright/test';
import { login, dialog, uid } from './helpers';

test.describe('People, reports and administration', () => {
  test('add an employee', async ({ page }, testInfo) => {
    const id = uid(testInfo);
    await login(page, 'admin');
    await page.goto('/employees');
    await page.getByRole('button', { name: /new employee/i }).click();
    const d = dialog(page);
    await d.getByPlaceholder('EMP-005').fill(`EMP-${id}`);
    await d.getByPlaceholder('Jane', { exact: true }).fill('Priya');
    await d.getByPlaceholder('Doe', { exact: true }).fill(`Test${id}`);
    await d.getByPlaceholder('jane.doe@company.com').fill(`priya.${id.toLowerCase()}@acme-corp.com`);
    await d.getByRole('button', { name: /save employee/i }).click();
    await expect(d).toBeHidden();
    await page.getByPlaceholder(/search by employee id/i).fill(`EMP-${id}`);
    await page.keyboard.press('Enter');
    await expect(page.locator('tbody tr', { hasText: `EMP-${id}` })).toBeVisible();
  });

  test('deleting asks for confirmation, and cancel keeps the record', async ({ page }, testInfo) => {
    const id = uid(testInfo);
    await login(page, 'admin');
    await page.goto('/employees');
    await page.getByRole('button', { name: /new employee/i }).click();
    const d = dialog(page);
    await d.getByPlaceholder('EMP-005').fill(`DEL-${id}`);
    await d.getByPlaceholder('Jane', { exact: true }).fill('Temp');
    await d.getByPlaceholder('Doe', { exact: true }).fill(`Person${id}`);
    await d.getByPlaceholder('jane.doe@company.com').fill(`temp.${id.toLowerCase()}@acme-corp.com`);
    await d.getByRole('button', { name: /save employee/i }).click();
    await expect(d).toBeHidden();

    await page.getByPlaceholder(/search by employee id/i).fill(`DEL-${id}`);
    await page.keyboard.press('Enter');
    const row = page.locator('tbody tr', { hasText: `DEL-${id}` });
    await row.getByRole('button', { name: /delete/i }).or(row.getByTitle(/delete/i)).first().click();
    await expect(page.getByTestId('confirm-cancel')).toBeVisible();
    await page.getByTestId('confirm-cancel').click();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: /delete/i }).or(row.getByTitle(/delete/i)).first().click();
    await page.getByTestId('confirm-ok').click();
    await expect(row).toHaveCount(0);
  });

  test('reports load and export to Excel', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/reports');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /export excel/i }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('settings tabs all open', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/settings');
    const labels = ['Company & Branding', 'Organization & Master Data', 'Asset Numbering & Barcodes', 'Email Notifications', 'Immutable Audit Logs', 'System Engine & Diagnostics'];
    for (const label of labels) {
      await page.locator('main nav button', { hasText: label }).click();
      await expect(page.locator('main')).not.toContainText(/something went wrong/i);
    }
    // the SMTP password is never shown in clear text
    await page.locator('main nav button', { hasText: 'Email Notifications' }).click();
    const pw = page.locator('main input[type="password"]').first();
    if (await pw.count()) expect(await pw.inputValue()).not.toMatch(/[A-Za-z0-9]{6,}/);
  });

  test('customization centre sections all open', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/customization');
    for (const section of [/custom fields/i, /numbering/i, /statuses/i, /email/i, /barcode/i, /feature/i, /disaster recovery/i, /branding/i]) {
      await page.locator('main button', { hasText: section }).first().click();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('create a backup from the disaster recovery centre', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/customization');
    await page.locator('main button', { hasText: /disaster recovery/i }).first().click();
    const create = page.getByRole('button', { name: /backup now|create backup|snapshot/i }).first();
    await expect(create).toBeVisible();
    const download = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
    await create.click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByText(/backup archive created/i).first()).toBeVisible({ timeout: 30_000 });
    await download;
  });
});
