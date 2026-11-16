import { test, expect, Page } from '@playwright/test';
import { login, dialog, uid, selectOptionContaining } from './helpers';

async function createAsset(page: Page, name: string, serial: string) {
  await page.goto('/assets?new=1');
  const d = dialog(page);
  await d.getByPlaceholder('e.g. Dell Latitude 7440').fill(name);
  await d.getByPlaceholder('e.g. SN-DELL-88219').fill(serial);
  await d.getByRole('button', { name: /save asset/i }).click();
  await expect(d).toBeHidden();
}

test.describe('Custody: allocate → employee signs → return', () => {
  test('full hand-over lifecycle', async ({ browser }, testInfo) => {
    const id = uid(testInfo);
    const name = `Custody Laptop ${id}`;
    const serial = `SN-CUS-${id}`;
    const deviceOpts = testInfo.project.use;

    // --- IT admin allocates the asset to John Doe
    const adminCtx = await browser.newContext(deviceOpts);
    const admin = await adminCtx.newPage();
    await login(admin, 'admin');
    await createAsset(admin, name, serial);

    await admin.goto('/allocations');
    await admin.getByRole('button', { name: /new allocation/i }).click();
    let d = dialog(admin);
    await expect(d.getByRole('heading', { name: /allocate it equipment/i })).toBeVisible();
    const selects = d.locator('select');
    await selectOptionContaining(selects.nth(0), serial);
    await selectOptionContaining(selects.nth(1), 'John Doe');
    await d.getByRole('button', { name: /issue asset/i }).click();
    await expect(d).toBeHidden();
    await expect(admin.locator('tbody tr', { hasText: name }).first()).toBeVisible();

    // --- John sees it in his portal and signs the hand-over receipt
    const empCtx = await browser.newContext(deviceOpts);
    const emp = await empCtx.newPage();
    await login(emp, 'employee');
    const card = emp.locator('div', { hasText: name }).filter({ has: emp.getByRole('button', { name: /sign handover receipt/i }) }).last();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /sign handover receipt/i }).click();
    d = dialog(emp);
    await d.locator('input[type="checkbox"]').check();
    await d.getByPlaceholder('e.g. John Doe').fill('John Doe');
    await d.getByRole('button', { name: /sign & complete/i }).click();
    await expect(d).toBeHidden();
    await expect(emp.locator('div', { hasText: name }).getByText(/custody acknowledged/i).first()).toBeVisible();

    // John downloads his signed receipt
    const [download] = await Promise.all([
      emp.waitForEvent('download'),
      emp.locator('div', { hasText: name }).getByRole('button', { name: /download pdf/i }).last().click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // --- Admin processes the return
    await admin.goto('/allocations');
    await admin.getByRole('button', { name: /process return/i }).click();
    d = dialog(admin);
    await selectOptionContaining(d.locator('select').first(), name);
    await d.getByRole('button', { name: /accept return/i }).click();
    await expect(d).toBeHidden();

    // --- the asset is back in stock and gone from John's portal
    await emp.reload();
    await expect(emp.getByText(/currently assigned hardware/i)).toBeVisible();
    await expect(emp.getByText(name).filter({ visible: true })).toHaveCount(0);
    // ...and listed under "Previously held equipment" with its receipt
    const history = emp.getByTestId('portal-history');
    await history.locator('summary').click();
    await expect(history.getByText(name)).toBeVisible();

    await adminCtx.close();
    await empCtx.close();
  });
});
