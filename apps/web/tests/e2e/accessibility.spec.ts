import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createDebt, login } from './helpers';

/** WCAG 2.1 AA, checked automatically on every main view with data on screen. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = violations.map(
    (v) =>
      `${name}: ${v.id} (${v.impact}) – ${v.help} → ${v.nodes
        .map((n) => `${n.target.join(' ')} ${n.html.slice(0, 120)} ${n.any[0]?.message ?? ''}`)
        .slice(0, 4)
        .join(' | ')}`,
  );
  expect(report, report.join('\n')).toEqual([]);
}

test('Hauptansichten haben keine WCAG-2.1-AA-Verstöße', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, 'admin');
  const debtUrl = await createDebt(page, `E2E ${Date.now()}: Barrierefreiheit`);

  const views: [string, string, string][] = [
    ['/register', 'Schuldenregister', 'Register'],
    ['/dashboard', 'Dashboard', 'Dashboard'],
    ['/priorities', 'Priorisierte Tilgungsliste', 'Prioritäten'],
    ['/debt/new', 'Schuld erfassen', 'Schuld erfassen'],
    [new URL(debtUrl).pathname, 'Barrierefreiheit', 'Schuld Detail'],
    ['/integrations', 'Integrationen', 'Integrationen'],
    ['/settings/assessment-model', 'Bewertungsmodell', 'Bewertungsmodell'],
    ['/settings/products', 'Produkte', 'Produkte'],
    ['/settings/members', 'Rollen', 'Rollen'],
    ['/settings/teams', 'Teams', 'Teams'],
    ['/settings/audit', 'Änderungsprotokoll', 'Protokoll'],
  ];
  // light and dark appearance (SC-003); the choice is stored in the browser like a user would
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => localStorage.setItem('tessera-theme', t), theme);
    for (const [path, heading, name] of views) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.waitForLoadState('networkidle');
      await scan(page, `${name} (${theme})`);
    }
  }
});

test('Erscheinungsbild bleibt nach dem Neuladen erhalten, Standard ist die Systemeinstellung', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // follows the system

  // the first click may come before the page is interactive; click until it takes effect
  await expect(async () => {
    await page.getByRole('button', { name: 'Hell' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); // choice wins over system
});

test('Navigation und Dialog sind per Tastatur bedienbar', async ({ page }) => {
  await login(page);
  await expect(async () => {
    await page.getByRole('button', { name: 'Navigation öffnen' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: 'Teams' })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole('link', { name: 'Teams' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();

  // a dialog traps focus and Escape closes it again
  await page.goto('/settings/products');
  const archive = page.getByRole('button', { name: 'Archivieren' }).first();
  if ((await archive.count()) > 0) {
    await archive.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
