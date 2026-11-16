import { test, expect } from '@playwright/test';
import { login, navigate, expectNoHorizontalOverflow, watchForErrors, isNarrow } from './helpers';

const ADMIN_PAGES: Array<{ testId: string; path: RegExp; heading: RegExp }> = [
  { testId: 'nav-assets', path: /\/assets$/, heading: /asset/i },
  { testId: 'nav-allocations', path: /\/allocations$/, heading: /custody|allocation/i },
  { testId: 'nav-tickets', path: /\/tickets$/, heading: /helpdesk|ticket/i },
  { testId: 'nav-maintenance', path: /\/maintenance$/, heading: /maintenance|repair/i },
  { testId: 'nav-licenses', path: /\/licenses$/, heading: /licen/i },
  { testId: 'nav-consumables', path: /\/consumables$/, heading: /spare|consumable/i },
  { testId: 'nav-employees', path: /\/employees$/, heading: /employee/i },
  { testId: 'nav-reports', path: /\/reports$/, heading: /report/i },
  { testId: 'nav-settings', path: /\/settings$/, heading: /settings/i },
  { testId: 'nav-customization', path: /\/customization$/, heading: /customi[sz]ation/i },
  { testId: 'nav-portal-my-assets', path: /\/portal\/my-assets$/, heading: /portal/i },
  { testId: 'nav-dashboard', path: /\/$/, heading: /good (morning|afternoon|evening)/i },
];

test.describe('Navigation and layout on every page', () => {
  test('super admin can reach every page through the menu, with no layout overflow or errors', async ({ page }) => {
    const errors = watchForErrors(page);
    await login(page, 'admin');
    for (const p of ADMIN_PAGES) {
      await test.step(p.testId, async () => {
        await navigate(page, p.testId);
        await expect(page).toHaveURL(p.path);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(p.heading);
        await page.waitForLoadState('networkidle');
        await expectNoHorizontalOverflow(page);
      });
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('support engineer menu hides admin-only pages', async ({ page }) => {
    await login(page, 'support');
    if (isNarrow(page)) await page.getByTestId('open-menu').click();
    const nav = isNarrow(page) ? page.getByRole('dialog', { name: 'Menu' }) : page.getByTestId('sidebar');
    await expect(nav.getByTestId('nav-tickets')).toBeVisible();
    await expect(nav.getByTestId('nav-settings')).toHaveCount(0);
    await expect(nav.getByTestId('nav-licenses')).toHaveCount(0);
  });

  test('phones show the bottom navigation bar', async ({ page }) => {
    await login(page, 'admin');
    const bottom = page.getByTestId('bottom-nav');
    if (isNarrow(page)) {
      await expect(bottom).toBeVisible();
      await bottom.getByRole('link', { name: 'Tickets' }).click();
      await expect(page).toHaveURL(/\/tickets$/);
      await bottom.getByRole('button', { name: 'More' }).click();
      await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    } else {
      await expect(bottom).toBeHidden();
    }
  });

  test('tables turn into cards on phones', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/tickets');
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    await expect(table).toHaveClass(/\brt\b/);
    const header = page.locator('table thead').first();
    if ((page.viewportSize()?.width || 1440) < 768) await expect(header).toBeHidden();
    else await expect(header).toBeVisible();
  });

  test('dark mode toggles and is remembered', async ({ page }) => {
    await login(page, 'admin');
    const html = page.locator('html');
    const wasDark = ((await html.getAttribute('class')) || '').includes('dark');
    await page.getByTestId('theme-toggle').click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
    await page.reload();
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
    await page.getByTestId('theme-toggle').click(); // restore
  });

  test('notifications panel opens', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('notifications').click();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
  });
});
