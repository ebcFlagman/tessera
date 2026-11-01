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
        .map((n) => n.target.join(' '))
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
  for (const [path, heading, name] of views) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await scan(page, name);
  }
});
