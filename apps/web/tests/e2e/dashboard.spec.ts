import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { login, pick } from './helpers';

const BOM = String.fromCharCode(0xfeff);

/** "1’234.5" / "≥ 12.5" -> number */
const num = (text: string) => Number(text.replace(/[^\d.-]/g, ''));
const tile = async (page: Page, label: string) =>
  num((await page.getByTestId(`tile-${label}`).innerText()).split('\n')[0] ?? '');

async function addDebt(page: Page, title: string, kind: string, effort: string) {
  await page.goto('/debt/new');
  await pick(page, 'Produkt', 'Plattform');
  await page.getByLabel('Titel').fill(title);
  await pick(page, 'Art', kind);
  await page.getByLabel('Aufwandsschätzung (Personentage)').fill(effort);
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

test('Dashboard folgt dem Register und der Export enthält die angezeigten Daten', async ({
  page,
}) => {
  const run = Date.now();
  await login(page);

  // figures before, for the Plattform product only
  await page.goto('/dashboard');
  await pick(page, 'Produkt', 'Plattform');
  await expect(page.getByTestId('tile-Schulden gesamt')).toBeVisible();
  await expect.poll(() => tile(page, 'Schulden gesamt')).toBeGreaterThanOrEqual(0);
  const before = {
    total: await tile(page, 'Schulden gesamt'),
    open: await tile(page, 'Davon offen'),
    effort: await tile(page, 'Offener Aufwand (PT)'),
  };

  await addDebt(page, `E2E ${run}: Dashboard A`, 'architectural', '2');
  await addDebt(page, `E2E ${run}: Dashboard B`, 'technical', '3.5');

  await page.goto('/dashboard');
  await pick(page, 'Produkt', 'Plattform');
  await expect
    .poll(() => tile(page, 'Schulden gesamt'), { message: 'total grows by the two new debts' })
    .toBe(before.total + 2);
  expect(await tile(page, 'Davon offen')).toBe(before.open + 2);
  expect(await tile(page, 'Offener Aufwand (PT)')).toBeCloseTo(before.effort + 5.5, 1);

  // charts are present, labelled, and have the same numbers as a table
  const statusChart = page.getByRole('img', { name: /^Nach Status/ });
  await expect(statusChart).toBeVisible();
  const panel = page.getByRole('region', { name: 'Nach Status' });
  await panel.getByText('Als Tabelle anzeigen').click();
  const counts = await panel.locator('table.data td').allInnerTexts();
  expect(counts.map(Number).reduce((a, b) => a + b, 0)).toBe(before.total + 2); // = total
  await expect(page.getByRole('region', { name: 'Offene Schulden' })).toBeVisible();

  // the register lists the same new debts for the same filter
  await page.goto('/register');
  await pick(page, /^Produkt/, 'Plattform');
  await page.getByLabel('Suche').fill(`E2E ${run}: Dashboard`);
  await expect(page.locator('tbody tr', { hasText: `E2E ${run}: Dashboard` })).toHaveCount(2);

  // CSV export of the register with those filters contains exactly those rows
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Als CSV exportieren' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^tessera-schulden-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = readFileSync(await download.path(), 'utf8').replace(BOM, '');
  const lines = csv.trimEnd().split('\r\n');
  expect(lines[0]).toContain('Titel;Produkt;Art;Status');
  expect(lines.slice(1).filter((l) => l.includes(`E2E ${run}: Dashboard`))).toHaveLength(2);
  expect(csv).toContain(`E2E ${run}: Dashboard A;Plattform;Architektur;Offen`);

  // and the dashboard export
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Kennzahlen als CSV' })).toBeEnabled();
  const [dashDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Kennzahlen als CSV' }).click(),
  ]);
  expect(dashDownload.suggestedFilename()).toMatch(/^tessera-dashboard-/);
  expect(readFileSync(await dashDownload.path(), 'utf8')).toContain('Datum;Schulden gesamt');
});
