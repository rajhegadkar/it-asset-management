import { test, expect } from '@playwright/test';
import { login, dialog, uid, selectOptionContaining, selectFirstReal } from './helpers';

test.describe('Licences, spare parts and maintenance', () => {
  test('add a software licence and assign a seat', async ({ page }, testInfo) => {
    const name = `Figma Pro ${uid(testInfo)}`;
    await login(page, 'admin');
    await page.goto('/licenses');
    await page.getByRole('button', { name: /add license/i }).click();
    let d = dialog(page);
    await d.getByPlaceholder('e.g. Adobe Creative Cloud All Apps').fill(name);
    await d.getByPlaceholder('e.g. Adobe Inc. / Microsoft').fill('Figma Inc.');
    await d.getByRole('button', { name: /save license record/i }).click();
    await expect(d).toBeHidden();

    const card = page.locator('div.rounded-xl, div.rounded-2xl', { hasText: name }).filter({ has: page.getByRole('button', { name: /assign seat to employee/i }) }).last();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /assign seat to employee/i }).click();
    d = dialog(page);
    await selectOptionContaining(d.locator('select').first(), 'John Doe');
    await d.getByRole('button', { name: /^assign seat$/i }).click();
    await expect(d).toBeHidden();
    await expect(card.getByText('John Doe')).toBeVisible();
  });

  test('add a spare part and issue stock', async ({ page }, testInfo) => {
    const id = uid(testInfo);
    const name = `USB-C Hub ${id}`;
    await login(page, 'admin');
    await page.goto('/consumables');
    await page.getByRole('button', { name: /new spare item/i }).click();
    let d = dialog(page);
    await d.getByPlaceholder('e.g. Crucial 32GB DDR5 SODIMM').fill(name);
    await d.getByPlaceholder('CSM-RAM-32G').fill(`CSM-HUB-${id}`);
    await d.getByRole('button', { name: /save spare part/i }).click();
    await expect(d).toBeHidden();

    const row = page.locator('tbody tr', { hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /issue \/ restock/i }).click();
    d = dialog(page);
    const empSelect = d.locator('select').nth(1);
    if (await empSelect.count()) await selectOptionContaining(empSelect, 'John Doe');
    await d.getByRole('button', { name: /record transaction/i }).click();
    await expect(d).toBeHidden();
    await expect(row).toContainText('9'); // 10 in stock - 1 issued
  });

  test('schedule maintenance and complete it', async ({ page }, testInfo) => {
    await login(page, 'admin');
    await page.goto('/maintenance');
    await page.getByRole('button', { name: /schedule service/i }).click();
    let d = dialog(page);
    await selectFirstReal(d.locator('select').first());
    const issue = `Fan noise check ${uid(testInfo)}`;
    await d.getByPlaceholder(/details of symptoms/i).fill(issue);
    await d.getByRole('button', { name: /dispatch work order/i }).click();
    await expect(d).toBeHidden();

    const row = page.locator('tbody tr', { hasText: issue });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /mark done/i }).click();
    d = dialog(page);
    await d.getByPlaceholder(/replaced lcd panel/i).fill('Cleaned fan and replaced thermal paste.');
    await d.getByRole('button', { name: /mark completed/i }).click();
    await expect(d).toBeHidden();
    await expect(row).toContainText(/completed/i);
  });
});
