import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

/** Opens the first asset's detail page and returns its id. */
async function openFirstAsset(page: Page) {
  const id = await page.evaluate(async () => {
    const token = localStorage.getItem('itam_access_token') || Object.entries(localStorage).find(([k]) => /access/i.test(k))?.[1];
    const r = await fetch('/api/v1/assets?limit=1', { headers: { Authorization: `Bearer ${token}` } });
    return (await r.json()).data[0].id as string;
  });
  await page.goto(`/assets/${id}`);
  return id;
}

async function setUserNameMode(page: Page, label: RegExp) {
  await page.goto('/customization');
  await page.locator('main button', { hasText: /barcode & pdf/i }).first().click();
  const setting = page.getByTestId('label-username-setting');
  await setting.locator('label', { hasText: label }).click();
  await page.getByRole('button', { name: /save pdf template/i }).click();
  await expect(page.getByText(/label settings .* saved/i).first()).toBeVisible();
}

test.describe.serial('Asset labels: user name option', () => {
  test('asks each time and sends the choice with the print request', async ({ page }) => {
    await login(page, 'admin');
    await setUserNameMode(page, /ask every time/i);
    await openFirstAsset(page);

    // Without user name
    await page.getByRole('button', { name: /print label/i }).first().click();
    const dlg = page.getByRole('dialog', { name: /print asset label/i });
    await expect(dlg).toBeVisible();
    await dlg.getByTestId('label-without-user').click();
    const [req, download] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/assets/labels/pdf') && r.method() === 'POST'),
      page.waitForEvent('download'),
      dlg.getByTestId('label-print').click(),
    ]);
    expect(req.postDataJSON().showUserName).toBe(false);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // With user name
    await page.getByRole('button', { name: /print label/i }).first().click();
    await dlg.getByTestId('label-with-user').click();
    const [req2] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/assets/labels/pdf') && r.method() === 'POST'),
      page.waitForEvent('download'),
      dlg.getByTestId('label-print').click(),
    ]);
    expect(req2.postDataJSON().showUserName).toBe(true);

    // Cancel prints nothing
    let printed = false;
    page.on('request', (r) => { if (r.url().includes('/assets/labels/pdf')) printed = true; });
    await page.getByRole('button', { name: /print label/i }).first().click();
    await dlg.getByTestId('label-cancel').click();
    await expect(dlg).toBeHidden();
    await page.waitForTimeout(300);
    expect(printed).toBe(false);
  });

  test('"Never show" in Customization Centre prints without asking', async ({ page }) => {
    await login(page, 'admin');
    await setUserNameMode(page, /never show/i);
    await openFirstAsset(page);
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/assets/labels/pdf') && r.method() === 'POST'),
      page.waitForEvent('download'),
      page.getByRole('button', { name: /print label/i }).first().click(),
    ]);
    expect(req.postDataJSON().showUserName).toBe(false);
    await expect(page.getByRole('dialog', { name: /print asset label/i })).toHaveCount(0);
    await setUserNameMode(page, /ask every time/i); // restore default for other runs
  });
});
