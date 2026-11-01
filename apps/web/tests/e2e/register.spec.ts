import { expect, test } from '@playwright/test';
import { login, pick, navigate } from './helpers';

/**
 * Needs the dev stack: `docker compose -f deploy/docker-compose.dev.yml up -d`, migrated + seeded
 * database, `pnpm dev`. Logs in via Keycloak as the seeded editor (see deploy/keycloak).
 */
test('Schuld erfassen, im Register finden, Status ändern und Verlauf prüfen', async ({ page }) => {
  // unique per run so the test can be repeated against the same database
  const title = `E2E ${Date.now()}: Modul A ist eng gekoppelt`;

  await login(page);

  await page.getByRole('link', { name: 'Neue Schuld erfassen' }).click();
  await pick(page, 'Produkt', 'Plattform');
  await page.getByLabel('Titel').fill(title);
  await pick(page, 'Art', 'Architektur');
  await page.getByLabel('Aufwandsschätzung (Personentage)').fill('5');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await pick(page, 'Status', 'Geplant');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText(/Status geändert \(Offen → Geplant\)/)).toBeVisible();

  await navigate(page, 'Register');
  await page.getByLabel('Suche').fill(title);
  await expect(page.getByRole('link', { name: title })).toBeVisible();
});
