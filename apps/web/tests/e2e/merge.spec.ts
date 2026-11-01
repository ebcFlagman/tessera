import { expect, test } from '@playwright/test';
import { createDebt, login } from './helpers';

test('Duplikat zusammenführen: Verlauf geht über, das Duplikat verschwindet aus dem Register', async ({
  page,
}) => {
  const run = Date.now();
  const keep = `E2E ${run}: behalten`;
  const duplicate = `E2E ${run}: Duplikat`;
  page.on('dialog', (d) => d.accept());
  await login(page);

  await createDebt(page, duplicate);
  const keepUrl = await createDebt(page, keep);
  await page.goto(keepUrl);

  // the duplicate is found by searching, no matter how many debts the product has
  await page.getByLabel('Duplikat suchen').fill(duplicate);
  await page.getByRole('combobox', { name: /^Duplikat/ }).selectOption({ label: duplicate });
  await page.getByRole('button', { name: 'Zusammenführen' }).click();

  // the history of the duplicate moved over and the merge is recorded
  await expect(page.getByText(`Duplikat „${duplicate}“ zusammengeführt`)).toBeVisible();
  await expect(page.getByText('angelegt')).toHaveCount(2);

  await page.goto('/register');
  await page.getByLabel('Suche').fill(`E2E ${run}`);
  await expect(page.locator('tbody tr', { hasText: keep })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: duplicate })).toHaveCount(0);
});
