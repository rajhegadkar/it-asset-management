import { test, expect } from '@playwright/test';
import { login, dialog, uid, expectToast, isNarrow } from './helpers';

test.describe('Asset register', () => {
  test('register a new asset, find it, open its record', async ({ page }, testInfo) => {
    const id = uid(testInfo);
    const name = `UI Test Laptop ${id}`;
    const serial = `SN-UI-${id}`;

    await login(page, 'admin');
    await page.goto('/assets');
    await page.getByRole('button', { name: /new asset/i }).first().click();

    const d = dialog(page);
    await expect(d.getByRole('heading', { name: /register new it hardware asset/i })).toBeVisible();
    await d.getByPlaceholder('e.g. Dell Latitude 7440').fill(name);
    await d.getByPlaceholder('e.g. SN-DELL-88219').fill(serial);
    await d.getByPlaceholder('e.g. Dell / Apple / HP').fill('Dell');
    await d.getByRole('button', { name: /save asset/i }).click();
    await expect(d).toBeHidden();

    // search the register
    await page.getByPlaceholder(/search by asset id/i).fill(serial);
    await page.getByRole('button', { name: /apply filter/i }).click().catch(() => undefined);
    const row = page.locator('tbody tr', { hasText: name });
    await expect(row).toBeVisible();

    // open the asset record
    await row.getByTitle('View Details').click();
    await expect(page).toHaveURL(/\/assets\/[0-9a-f-]{36}$/);
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(page.getByText(serial).first()).toBeVisible();
  });

  test('the dashboard "New asset" shortcut opens the form', async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: /new asset/i }).first().click();
    await expect(page).toHaveURL(/\/assets\?new=1/);
    await expect(dialog(page).getByRole('heading', { name: /register new it hardware asset/i })).toBeVisible();
    await dialog(page).getByTestId('modal-close').click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('dashboard tiles link to filtered views', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('kpi-available-in-stock').click();
    await expect(page).toHaveURL(/\/assets\?status=AVAILABLE/);
  });

  test('global search finds an asset by serial number', async ({ page }) => {
    await login(page, 'admin');
    if (isNarrow(page) && (page.viewportSize()?.width || 0) < 768) {
      await page.getByRole('button', { name: 'Search assets' }).click();
      await page.getByRole('dialog', { name: 'Search assets' }).getByPlaceholder(/tag, serial, name or person/i).fill('SN-');
      await expect(page.getByRole('dialog', { name: 'Search assets' }).locator('button', { hasText: 'S/N' }).first()).toBeVisible();
    } else {
      await page.getByTestId('global-search').fill('SN-');
      await expect(page.locator('button', { hasText: 'S/N' }).first()).toBeVisible();
    }
  });

  test('a duplicate serial number is rejected with a clear message', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/assets?new=1');
    const d = dialog(page);
    await d.getByPlaceholder('e.g. Dell Latitude 7440').fill('Duplicate check');
    await d.getByPlaceholder('e.g. SN-DELL-88219').fill('SN-HP-840G9-1102'); // seeded asset
    await d.getByRole('button', { name: /save asset/i }).click();
    await expect(page.getByTestId('toast-error').filter({ hasText: /already exists/i }).first()).toBeVisible({ timeout: 10_000 });
    await expectToast(page, 'error').catch(() => undefined);
  });

  test('editing an asset\'s purchase cost saves (custom fields included)', async ({ page }) => {
    await login(page, 'admin');
    const id = await page.evaluate(async () => {
      const token = localStorage.getItem('itam_access_token');
      const r = await fetch('/api/v1/assets?limit=1', { headers: { Authorization: `Bearer ${token}` } });
      return (await r.json()).data[0].id as string;
    });
    await page.goto(`/assets/${id}`);
    await page.getByRole('button', { name: /edit asset/i }).first().click();
    const d = dialog(page);
    const cost = String(1000 + Math.floor(Math.random() * 8000));
    await d.getByLabel(/purchase cost/i).fill(cost);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/assets/${id}`) && r.request().method() === 'PUT'),
      d.getByRole('button', { name: /save asset changes/i }).click(),
    ]);
    expect(res.status(), await res.text()).toBe(200);
    await expect(d).toBeHidden();
  });
});
