import { expect, test, type Page } from '@playwright/test';
import { createDebt, login } from './helpers';

async function assess(page: Page, values: Record<string, string>) {
  for (const [criterion, value] of Object.entries(values)) {
    await page.getByLabel(criterion, { exact: true }).selectOption(value);
  }
  await page.getByRole('button', { name: 'Bewertung speichern' }).click();
}

test('bewerten, Rangfolge prüfen und Priorität mit Begründung überschreiben', async ({ page }) => {
  const run = Date.now();
  const urgent = `E2E ${run}: dringend`;
  const minor = `E2E ${run}: klein`;
  await login(page);

  // two debts, one assessed as urgent and one as minor
  await createDebt(page, urgent);
  await assess(page, { Auswirkung: '5', Risiko: '5', Folgekosten: '5', Aufwand: '1' });
  await expect(page.getByTestId('priority-calculated')).toHaveText('100');
  await expect(page.getByText('Herleitung').first()).toBeVisible();

  await createDebt(page, minor);
  await assess(page, { Auswirkung: '1', Risiko: '1', Folgekosten: '1', Aufwand: '5' });
  await expect(page.getByTestId('priority-calculated')).toHaveText('0');

  // ranking: urgent before minor
  await page.getByRole('link', { name: 'Prioritäten' }).click();
  const rows = page.locator('tbody tr', { hasText: `E2E ${run}` });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(urgent);
  await expect(rows.nth(1)).toContainText(minor);

  // override without a reason is refused, with a reason it wins
  await rows.nth(1).getByRole('link').click();
  await page.getByLabel('Priorität überschreiben (0–100)').fill('100');
  await page.getByRole('button', { name: 'Überschreiben', exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Begründung');
  await page.getByLabel('Begründung', { exact: true }).fill('Vertragsrisiko');
  await page.getByRole('button', { name: 'Überschreiben', exact: true }).click();
  await expect(page.getByTestId('priority-override')).toContainText('100');
  await expect(page.getByTestId('priority-calculated')).toHaveText('0'); // stays separate
  await expect(page.getByTestId('priority-effective')).toHaveText('100');
  await expect(page.getByText('Priorität überschrieben').first()).toBeVisible();

  // both are now at 100; removing the override restores the calculated value
  await page.getByRole('button', { name: 'Überschreibung entfernen' }).click();
  await expect(page.getByTestId('priority-effective')).toHaveText('0');
});
