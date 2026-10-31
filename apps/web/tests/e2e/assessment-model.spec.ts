import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('Administrator speichert eine neue Modellversion, Editor wird abgewiesen', async ({
  browser,
}) => {
  // separate contexts = separate Keycloak sessions
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, 'admin');
  await admin.getByRole('link', { name: 'Bewertungsmodell' }).click();
  await expect(admin.getByRole('heading', { name: 'Bewertungsmodell' })).toBeVisible();
  await admin.getByRole('button', { name: 'Neue Version speichern' }).click();
  await expect(admin.getByRole('status')).toContainText(/Version \d+ gespeichert/);
  await adminCtx.close();

  const editorCtx = await browser.newContext();
  const editor = await editorCtx.newPage();
  await login(editor, 'editor');
  await editor.getByRole('link', { name: 'Bewertungsmodell' }).click();
  await expect(editor.getByRole('heading', { name: 'Bewertungsmodell' })).toBeVisible();
  await editor.getByRole('button', { name: 'Neue Version speichern' }).click();
  await expect(editor.locator('p[role="alert"]')).toContainText('Administratoren');
  await editorCtx.close();
});
