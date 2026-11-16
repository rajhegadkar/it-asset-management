import { test, expect } from '@playwright/test';
import { login, dialog, uid } from './helpers';

test.describe('Helpdesk', () => {
  test('employee raises a ticket, IT replies and resolves it', async ({ browser }, testInfo) => {
    const subject = `Keyboard keys sticking ${uid(testInfo)}`;
    const deviceOpts = testInfo.project.use;

    // employee raises the ticket from the portal
    const empCtx = await browser.newContext(deviceOpts);
    const emp = await empCtx.newPage();
    await login(emp, 'employee');
    await emp.getByRole('button', { name: /report issue/i }).click();
    let d = dialog(emp);
    await d.getByPlaceholder(/screen flickering/i).fill(subject);
    await d.getByPlaceholder(/describe the issue/i).fill('Several keys stick after the latest update.');
    await d.getByRole('button', { name: /submit support ticket/i }).click();
    await expect(d).toBeHidden();
    await expect(emp.getByText(subject).first()).toBeVisible();

    // IT opens it, replies and resolves
    const ctx = await browser.newContext(deviceOpts);
    const page = await ctx.newPage();
    await login(page, 'support');
    await page.goto('/tickets');
    const row = page.locator('tbody tr', { hasText: subject });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /view/i }).click();

    d = dialog(page);
    await expect(d.getByText(subject).first()).toBeVisible();
    await d.getByPlaceholder(/post response/i).fill('Please try the replacement keyboard at the IT desk.');
    await d.getByRole('button', { name: /^post$/i }).click();
    await expect(d.getByText('Please try the replacement keyboard at the IT desk.')).toBeVisible();

    await d.getByRole('button', { name: /mark resolved/i }).click();
    await expect(d.getByText(/resolved/i).first()).toBeVisible();
    // a resolved ticket can only be reopened or closed now
    await expect(d.getByRole('button', { name: /mark reopened/i })).toBeVisible();

    // the employee sees the reply (not internal notes) and the new status
    await emp.reload();
    await expect(emp.locator('tr, div', { hasText: subject }).getByText(/resolved/i).first()).toBeVisible();

    await ctx.close();
    await empCtx.close();
  });

  test('IT staff can raise a ticket for an employee', async ({ page }, testInfo) => {
    const subject = `VPN drops hourly ${uid(testInfo)}`;
    await login(page, 'admin');
    await page.goto('/tickets');
    await page.getByRole('button', { name: /raise it ticket/i }).click();
    const d = dialog(page);
    await d.getByPlaceholder(/brief summary/i).fill(subject);
    await d.getByPlaceholder(/include error codes/i).fill('Disconnects roughly every hour.');
    await d.getByRole('button', { name: /submit ticket/i }).click();
    await expect(d).toBeHidden();
    await expect(page.locator('tbody tr', { hasText: subject })).toBeVisible();
  });
});
