import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** Seeded users: admin (admin of both products), editor (editor of Plattform), norole (no role). */
test('ohne Rolle lesen, aber nicht ändern; ein Administrator vergibt die Rolle, das Protokoll hält es fest', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const run = Date.now();
  const title = `E2E ${run}: Rolle`;
  // separate contexts = separate Keycloak sessions
  const adminCtx = await browser.newContext();
  const userCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const user = await userCtx.newPage();

  try {
    await login(admin, 'admin');
    await login(user, 'norole');

    // reading is allowed without a role
    await user.goto('/register');
    await expect(user.getByRole('heading', { name: 'Schuldenregister' })).toBeVisible();

    // writing is refused with an explanation
    await user.goto('/debt/new');
    await user.getByLabel('Produkt').selectOption({ label: 'Plattform' });
    await user.getByLabel('Titel').fill(title);
    await user.getByRole('button', { name: 'Anlegen' }).click();
    await expect(user.locator('p[role="alert"], ul[role="alert"]').first()).toContainText(
      'Dafür fehlt die Berechtigung',
    );

    // neither roles nor the change log are open to them
    await user.goto('/settings/audit');
    await expect(user.locator('p[role="alert"]')).toContainText('Nur Administratoren');
    await user.goto('/settings/members');
    const addForm = user.getByRole('form', { name: 'Mitglied hinzufügen' });
    await expect(addForm).toBeVisible();
    await addForm.getByLabel('Benutzer').selectOption({ label: 'Nora Ohnerolle' });
    await addForm.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(user.locator('p[role="alert"]')).toContainText('Dafür fehlt die Berechtigung');

    // an administrator grants the role
    await admin.goto('/settings/members');
    await admin.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Plattform' });
    const adminForm = admin.getByRole('form', { name: 'Mitglied hinzufügen' });
    await adminForm.getByLabel('Benutzer').selectOption({ label: 'Nora Ohnerolle' });
    await adminForm.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(admin.getByRole('combobox', { name: 'Rolle von Nora Ohnerolle' })).toHaveValue(
      'editor',
    );

    // now the same action works
    await user.goto('/debt/new');
    await user.getByLabel('Produkt').selectOption({ label: 'Plattform' });
    await user.getByLabel('Titel').fill(title);
    await user.getByRole('button', { name: 'Anlegen' }).click();
    await expect(user.getByRole('heading', { name: title })).toBeVisible();

    // the change log shows who changed which role, when
    await admin.goto('/settings/audit');
    await admin.getByLabel(/^Aktion/).selectOption({ label: 'Rolle geändert' });
    const row = admin.locator('tbody tr', { hasText: 'Nora Ohnerolle' }).first();
    await expect(row).toContainText('Ada Admin');
    await expect(row).toContainText('Rolle geändert');
    await expect(row).toContainText('Plattform');
    await expect(admin.locator('body')).not.toContainText('credentials');
  } finally {
    // take the role away again so the test can be repeated
    await admin.goto('/settings/members');
    await admin.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Plattform' });
    await admin.locator('tbody tr').first().waitFor(); // the list must be loaded before looking for the role
    const member = admin.locator('tbody tr', { hasText: 'Nora Ohnerolle' });
    if ((await member.count()) > 0) {
      await member.getByRole('button', { name: 'Entfernen' }).click();
      await expect(member).toHaveCount(0);
    }
    await adminCtx.close();
    await userCtx.close();
  }
});
