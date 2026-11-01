import { expect, test, type Page } from '@playwright/test';
import { login, pick } from './helpers';
import { MockSonar } from './mock-sonar';

/**
 * Needs the full stack including the worker (`pnpm --filter @tessera/worker dev`), started with
 * SOURCE_ALLOWED_HOSTS=localhost so that the local mock source is reachable.
 */
const PORT = 4010;
const TOKEN = 'e2e-secret-token';
const WRONG_TOKEN = 'wrong-token-9876';

async function connect(page: Page, name: string, projectKey: string, token: string) {
  await page.goto('/integrations');
  await expect(page.getByRole('heading', { name: 'Integrationen' })).toBeVisible();
  await pick(page, 'Produkt', 'Plattform', true);
  const form = page.getByRole('form', { name: 'Neue Integration' });
  await form.getByLabel('Name', { exact: true }).fill(name);
  await form.getByLabel('Projektschlüssel').fill(projectKey);
  await form.getByLabel(/Basis-URL/).fill(`http://localhost:${PORT}`);
  await form.getByLabel('Zugriffstoken').fill(token);
  await form.getByRole('button', { name: 'Verbinden' }).click();
  const card = page.getByTestId('integration').filter({ hasText: name });
  await expect(card).toBeVisible();
  return card;
}

test('Quelle anbinden, importieren, wiederholen ohne Duplikate und Behebung übernehmen', async ({
  page,
}) => {
  test.setTimeout(180_000); // several import runs are awaited
  const run = Date.now();
  const mock = new MockSonar(TOKEN);
  mock.issues = [
    { key: `A${run}`, message: `E2E ${run}: Methode zu lang` },
    { key: `B${run}`, message: `E2E ${run}: Klasse zu komplex` },
  ];
  await mock.start(PORT);
  const name = `E2E Sonar ${run}`;

  try {
    await login(page, 'admin');
    const card = await connect(page, name, `e2e-${run}`, TOKEN);

    await card.getByRole('button', { name: 'Verbindung testen' }).click();
    await expect(card.getByRole('status')).toContainText('Verbindung steht');

    // import; the schedule may also have started one, so assert on the outcome, not on a counter
    await card.getByRole('button', { name: 'Import starten' }).click();
    await expect(card.getByTestId('latest-run')).toContainText('abgeschlossen', {
      timeout: 30_000,
    });

    await page.goto('/register');
    await pick(page, 'Quelle', 'SonarCloud');
    await page.getByLabel('Suche').fill(`E2E ${run}`);
    const rows = page.locator('tbody tr', { hasText: `E2E ${run}` });
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('SonarCloud');

    // a second import must not create duplicates
    const before = mock.requests;
    await page.goto('/integrations');
    await pick(page, 'Produkt', 'Plattform', true);
    const card2 = page.getByTestId('integration').filter({ hasText: name });
    await card2.getByRole('button', { name: 'Import starten' }).click();
    await expect.poll(() => mock.requests, { timeout: 30_000 }).toBeGreaterThan(before);
    await expect(card2.getByTestId('latest-run')).toContainText('abgeschlossen', {
      timeout: 30_000,
    });
    await page.goto('/register');
    await pick(page, 'Quelle', 'SonarCloud');
    await page.getByLabel('Suche').fill(`E2E ${run}`);
    await expect(page.locator('tbody tr', { hasText: `E2E ${run}` })).toHaveCount(2);

    // one issue is resolved in the source: the debt is repaid by the next import
    mock.issues = mock.issues.slice(1);
    await page.goto('/integrations');
    await pick(page, 'Produkt', 'Plattform', true);
    await page
      .getByTestId('integration')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Import starten' })
      .click();
    await expect(async () => {
      await page.goto('/register');
      await pick(page, /^Status/, 'Getilgt');
      await page.getByLabel('Suche').fill(`E2E ${run}`);
      await expect(page.locator('tbody tr', { hasText: 'Methode zu lang' })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 40_000 });
    await page
      .locator('tbody tr', { hasText: 'Methode zu lang' })
      .getByRole('link', { name: /Methode/ })
      .click();
    await expect(page.getByText('in Quelle behoben').first()).toBeVisible();

    // wrong token: readable error and a visible notice for administrators
    const bad = await connect(page, `${name} (ungueltig)`, `e2e-${run}`, WRONG_TOKEN);
    await bad.getByRole('button', { name: 'Import starten' }).click();
    await expect(bad.getByTestId('latest-run')).toContainText('fehlgeschlagen', {
      timeout: 30_000,
    });
    await expect(bad.getByRole('alert')).toContainText('Zugangsdaten');
    await expect(page.getByTestId('integration-alert')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(WRONG_TOKEN); // secrets are never shown
  } finally {
    // disconnect both again so the test can be repeated
    await page.goto('/integrations');
    await pick(page, 'Produkt', 'Plattform', true);
    const cards = page.getByTestId('integration').filter({ hasText: `E2E Sonar ${run}` });
    while ((await cards.count()) > 0) {
      const before = await cards.count();
      await cards.first().getByRole('button', { name: 'Trennen' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Trennen' }).click();
      await expect(cards).toHaveCount(before - 1);
    }
    await mock.stop();
  }
});
