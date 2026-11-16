import { expect, Locator, Page, TestInfo } from '@playwright/test';

export const USERS = {
  admin: { email: 'admin@acme-corp.com', password: 'Admin@123456', home: '/' },
  itAdmin: { email: 'itadmin@acme-corp.com', password: 'Admin@123456', home: '/' },
  support: { email: 'support@acme-corp.com', password: 'Admin@123456', home: '/' },
  employee: { email: 'john.doe@acme-corp.com', password: 'User@123456', home: '/portal/my-assets' },
} as const;
export type Role = keyof typeof USERS;

/** Unique, readable suffix per device project so the three runs never collide on shared data. */
export function uid(testInfo: TestInfo) {
  return `${testInfo.project.name.slice(0, 3).toUpperCase()}${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export const isNarrow = (page: Page) => (page.viewportSize()?.width || 1440) < 1024;

export async function login(page: Page, role: Role) {
  const u = USERS[role];
  await page.goto('/login');
  await page.locator('#login-id').fill(u.email);
  await page.locator('#login-password').fill(u.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(new RegExp(`${u.home === '/' ? '/$' : u.home}`), { timeout: 20_000 });
  await expect(page.locator('main')).toBeVisible();
}

/** Navigate with the real navigation: sidebar on desktop, drawer menu on tablet / phone. */
export async function navigate(page: Page, testId: string) {
  if (isNarrow(page)) {
    await page.getByTestId('open-menu').click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    await drawer.getByTestId(testId).click();
    await expect(drawer).toBeHidden();
  } else {
    await page.getByTestId('sidebar').getByTestId(testId).click();
  }
}

/** The top-most open dialog. */
export const dialog = (page: Page) => page.locator('[role="dialog"][aria-modal="true"]').last();

/** Picks the first <option> whose text contains `text` (option labels include tags and departments). */
export async function selectOptionContaining(select: Locator, text: string | RegExp, timeout = 10_000) {
  const arg = typeof text === 'string' ? text : ({ source: text.source, flags: text.flags } as any);
  const deadline = Date.now() + timeout;
  let value: string | null = null;
  // options are often filled by an API call after the modal opens, so poll briefly
  while (Date.now() < deadline) {
    value = await select.evaluate((el, t) => {
      const re = typeof t === 'string' ? null : new RegExp(t.source, t.flags);
      const opt = Array.from((el as HTMLSelectElement).options).find(
        (o) => o.value && (re ? re.test(o.text) : o.text.includes(t as string))
      );
      return opt ? opt.value : null;
    }, arg);
    if (value) break;
    await select.page().waitForTimeout(250);
  }
  if (!value) throw new Error(`No option containing "${text}"`);
  await select.selectOption(value);
}

export async function expectToast(page: Page, type: 'success' | 'error' = 'success') {
  await expect(page.getByTestId(`toast-${type}`).first()).toBeVisible();
}

/** Fails if the page scrolls sideways (content wider than the screen). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(1);
}

/** Collects uncaught errors and failed API calls (5xx) while a test runs. */
export function watchForErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 500) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return errors;
}

/** Selects the first option that has a value (skips "-- Choose … --" placeholders). */
export async function selectFirstReal(select: Locator) {
  const value = await select.evaluate((el) => Array.from((el as HTMLSelectElement).options).find((o) => o.value)?.value || null);
  if (!value) throw new Error('No selectable option');
  await select.selectOption(value);
}
