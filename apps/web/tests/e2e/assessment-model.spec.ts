import { expect, test } from '@playwright/test';
import { login, navigate } from './helpers';

test('Administrator speichert eine neue Modellversion, Editor wird abgewiesen', async ({
  browser,
}) => {
  // separate contexts = separate Keycloak sessions
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, 'admin');
  await navigate(admin, 'Bewertungsmodell');
  await expect(admin.getByRole('heading', { name: 'Bewertungsmodell' })).toBeVisible();
  await admin.getByRole('button', { name: 'Neue Version speichern' }).click();
  await expect(admin.getByRole('status')).toContainText(/Version \d+ gespeichert/);
  await adminCtx.close();

  const editorCtx = await browser.newContext();
  const editor = await editorCtx.newPage();
  await login(editor, 'editor');
  await navigate(editor, 'Bewertungsmodell');
  await expect(editor.getByRole('heading', { name: 'Bewertungsmodell' })).toBeVisible();
  await editor.getByRole('button', { name: 'Neue Version speichern' }).click();
  await expect(
    editor.locator('[role="alert"]', { hasText: 'Administratoren' }).first(),
  ).toBeVisible();
  await editorCtx.close();
});
