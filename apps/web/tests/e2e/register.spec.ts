import { expect, test } from '@playwright/test';

/**
 * Needs the dev stack: `docker compose -f deploy/docker-compose.dev.yml up -d`, migrated + seeded
 * database, `pnpm dev`. Logs in via Keycloak as the seeded editor (see deploy/keycloak).
 */
test('Schuld erfassen, im Register finden, Status ändern und Verlauf prüfen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('editor');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('link', { name: 'Neue Schuld erfassen' }).click();
  await page.getByLabel('Produkt').selectOption({ label: 'Plattform' });
  await page.getByLabel('Titel').fill('E2E: Modul A ist eng gekoppelt');
  await page.getByLabel('Art').selectOption('architectural');
  await page.getByLabel('Aufwandsschätzung (Personentage)').fill('5');
  await page.getByRole('button', { name: 'Anlegen' }).click();

  await expect(page.getByRole('heading', { name: 'E2E: Modul A ist eng gekoppelt' })).toBeVisible();
  await page.getByLabel('Status').selectOption('planned');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/Status geändert \(Offen → Geplant\)/)).toBeVisible();

  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByLabel('Suche').fill('E2E: Modul A');
  await expect(page.getByRole('link', { name: 'E2E: Modul A ist eng gekoppelt' })).toBeVisible();
});
