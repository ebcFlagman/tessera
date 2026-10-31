import { expect, type Page } from '@playwright/test';

/** Logs in through Keycloak as one of the seeded test users (see deploy/keycloak). */
export async function login(page: Page, user: 'editor' | 'admin' | 'norole' = 'editor') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.locator('input[name="username"]').fill(user);
  await page.locator('input[name="password"]').fill(user);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Schuldenregister' })).toBeVisible();
}

/** Creates a debt in product "Plattform" and returns to its detail page. */
export async function createDebt(page: Page, title: string) {
  await page.goto('/debt/new');
  await page.getByLabel('Produkt').selectOption({ label: 'Plattform' });
  await page.getByLabel('Titel').fill(title);
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}
