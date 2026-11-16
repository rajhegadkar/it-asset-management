import { test, expect } from '@playwright/test';
import { login, dialog, selectOptionContaining } from './helpers';

/**
 * Pick-lists must offer every record, not just the first page of 100.
 * Creates enough employees to push the total past 100, then picks the newest one in the allocation form.
 * Runs once (desktop) — the data is shared by every device project.
 */
test('allocation pick-list includes employees beyond the first 100', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'data-heavy check runs once');
  test.setTimeout(120_000);
  await login(page, 'admin');

  const tag = Date.now().toString(36).toUpperCase();
  const total = await page.evaluate(async (tag) => {
    const token = localStorage.getItem('itam_access_token');
    const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const count = async () => (await (await fetch('/api/v1/employees?limit=1', { headers: h })).json()).pagination.total as number;
    const need = Math.max(0, 125 - (await count()));
    for (let i = 0; i < need; i++) {
      await fetch('/api/v1/employees', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ employeeId: `SC-${tag}-${i}`, firstName: 'Scale', lastName: `User ${tag} ${i}`, email: `scale.${tag.toLowerCase()}.${i}@acme-corp.com` }),
      });
    }
    // and one guaranteed to sort last
    await fetch('/api/v1/employees', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ employeeId: `ZZ-${tag}`, firstName: 'Zz Last', lastName: tag, email: `zz.${tag.toLowerCase()}@acme-corp.com` }),
    });
    return count();
  }, tag);
  expect(total).toBeGreaterThan(100);

  await page.goto('/allocations');
  await page.getByRole('button', { name: /new allocation/i }).click();
  const employeeSelect = dialog(page).locator('select').nth(1);
  await selectOptionContaining(employeeSelect, `Zz Last ${tag}`);
  expect(await employeeSelect.locator('option[value]:not([value=""])').count()).toBeGreaterThan(100);
});
