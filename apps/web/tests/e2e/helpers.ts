import { expect, type Locator, type Page } from '@playwright/test';

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
  await pick(page, 'Produkt', 'Plattform');
  await page.getByLabel('Titel').fill(title);
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}

/**
 * Chooses an entry in one of the library's select lists: open the combobox, click the option.
 * (The list is rendered in a portal, hence the lookup on the page.) The dashboard/register values
 * of kind and status come in as the visible labels.
 */
export async function pick(
  scope: Page | Locator,
  name: string | RegExp,
  option: string,
  exact = false,
) {
  const page = 'goto' in scope ? scope : scope.page();
  const labels: Record<string, string> = { architectural: 'Architektur', technical: 'Technisch' };
  const combo = scope.getByRole('combobox', { name, exact });
  const entry = page.getByRole('option', { name: labels[option] ?? option, exact: true });
  // the first click can land before the page is interactive, so open again until the entry shows
  await expect(async () => {
    if (!(await entry.isVisible())) await combo.click();
    await entry.click({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

/** Opens the navigation menu (the hamburger button) and follows a link in it. */
export async function navigate(page: Page, link: string) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Navigation öffnen' }).click();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: link })
      .click({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}
