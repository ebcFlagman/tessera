import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('ohne Produkt führt ein Hinweis zum Anlegen des ersten Produkts', async ({ page }) => {
  await login(page, 'admin');
  // simulate an empty instance: the products list comes back empty, nothing is changed in the database
  await page.route('**/api/v1/products**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      : route.continue(),
  );

  await page.goto('/register');
  const notice = page.getByTestId('no-product');
  await expect(notice).toContainText('Es gibt noch kein Produkt');
  await notice.getByRole('link', { name: 'Erstes Produkt anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Erstes Produkt anlegen' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Erstes Produkt anlegen' })).toBeVisible();

  // the debt form does not show an unusable empty selection either
  await page.goto('/debt/new');
  await expect(page.getByTestId('no-product')).toBeVisible();
  await expect(page.getByLabel('Produkt')).toHaveCount(0);
});

test('ein Administrator legt ein Produkt an, sieht es und archiviert es wieder', async ({
  page,
}) => {
  const name = `E2E Produkt ${Date.now()}`;
  page.on('dialog', (d) => d.accept());
  await login(page, 'admin');
  await page.goto('/settings/products');
  await expect(page.getByRole('heading', { name: 'Produkte' })).toBeVisible();

  // validation first
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('einen Namen');

  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Beschreibung (optional)').fill('Von einem Test angelegt');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('status')).toContainText(`Produkt „${name}“ angelegt`);
  const row = page.getByTestId('product-row').filter({ hasText: name });
  await expect(row).toBeVisible();

  // the same name twice is refused with an explanation
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('existiert bereits');

  // it is selectable where debts are recorded
  await page.goto('/debt/new');
  await expect(page.getByLabel('Produkt').locator('option', { hasText: name })).toHaveCount(1);

  // archiving takes it out of the lists again (nothing is deleted)
  await page.goto('/settings/products');
  await page
    .getByTestId('product-row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Archivieren' })
    .click();
  await expect(page.getByTestId('product-row').filter({ hasText: name })).toHaveCount(0);
  await page.getByLabel('Archivierte anzeigen').check();
  await expect(page.getByTestId('product-row').filter({ hasText: name })).toContainText(
    'archiviert',
  );
});

test('ein Benutzer ohne Rolle kann kein weiteres Produkt anlegen', async ({ page }) => {
  await login(page, 'norole');
  await page.goto('/settings/products');
  await page.getByLabel('Name', { exact: true }).fill(`E2E Verboten ${Date.now()}`);
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Nur Administratoren');
});
