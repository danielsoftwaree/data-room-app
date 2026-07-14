import { expect, test } from '@playwright/test';
import {
  createDataroom,
  createFolder,
  deleteDataroom,
  rowName,
  uniqueName,
  uploadPdf,
} from '../src/helpers';

test('shares a file behind a password, opens it publicly, and revokes the link', async ({
  page,
  request,
  browser,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Share'));
  const password = 's3cret-pass';

  try {
    await uploadPdf(request, dataroom.id, 'shared.pdf');
    await page.goto(`/datarooms/${dataroom.id}`);
    await expect(rowName(page, 'shared.pdf')).toBeVisible();

    // Owner opens the share dialog from the row's quick share button and turns
    // the link on via the General access control.
    await page.getByRole('button', { name: 'Share shared.pdf' }).click();
    const shareDialog = page.getByRole('dialog');
    await shareDialog.getByRole('combobox', { name: 'General access' }).click();
    await page.getByRole('option', { name: 'Anyone with the link' }).click();

    // The link is shown read-only once created; extract it for the public visit.
    const shareUrl = await shareDialog.getByLabel('Share link').inputValue();
    expect(shareUrl).toContain('/share/');

    // The password is a separate toggle on top of the link.
    await shareDialog.getByRole('switch', { name: 'Require password' }).click();
    await shareDialog.getByPlaceholder('At least 4 characters').fill(password);
    await shareDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Password set')).toBeVisible();

    // A fresh, unauthenticated context stands in for an external recipient.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    try {
      await publicPage.goto(shareUrl);
      await expect(publicPage.getByRole('heading', { name: /password protected/i })).toBeVisible();

      // Wrong password is rejected inline.
      await publicPage.getByLabel('Password').fill('not-the-password');
      await publicPage.getByRole('button', { name: 'Unlock' }).click();
      await expect(publicPage.getByText('Incorrect password')).toBeVisible();

      // Correct password reveals the file name and a download affordance.
      await publicPage.getByLabel('Password').fill(password);
      await publicPage.getByRole('button', { name: 'Unlock' }).click();
      await expect(publicPage.getByRole('heading', { name: 'shared.pdf' })).toBeVisible();
      await expect(publicPage.getByRole('link', { name: 'Download' })).toBeVisible();

      // Owner revokes the link by switching access back to Restricted.
      await shareDialog.getByRole('combobox', { name: 'General access' }).click();
      await page.getByRole('option', { name: 'Restricted' }).click();
      await expect(page.getByText('Share link removed')).toBeVisible();

      // The public link no longer works: the probe on load hits the dead-link state.
      await publicPage.reload();
      await expect(publicPage.getByText(/invalid or has been removed/i)).toBeVisible();
    } finally {
      await publicContext.close();
    }
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});

test('shares a folder without a password and browses it anonymously', async ({
  page,
  request,
  browser,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Folder Share'));

  try {
    const folder = await createFolder(request, dataroom.id, 'Legal');
    await uploadPdf(request, dataroom.id, 'nda.pdf', folder.id);
    await page.goto(`/datarooms/${dataroom.id}`);
    await expect(rowName(page, 'Legal')).toBeVisible();

    // Owner creates a passwordless link straight from the row's share button.
    await page.getByRole('button', { name: 'Share Legal' }).click();
    const shareDialog = page.getByRole('dialog');
    await shareDialog.getByRole('combobox', { name: 'General access' }).click();
    await page.getByRole('option', { name: 'Anyone with the link' }).click();
    const shareUrl = await shareDialog.getByLabel('Share link').inputValue();
    expect(shareUrl).toContain('/share/');

    // An anonymous visitor opens the folder straight away — no password gate.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    try {
      await publicPage.goto(shareUrl);
      await expect(publicPage.getByRole('heading', { name: 'Legal' })).toBeVisible();

      // The listing behaves like a drive: opening a file shows the PDF preview.
      await publicPage.getByRole('button', { name: 'nda.pdf', exact: true }).click();
      await expect(publicPage.getByRole('heading', { name: 'nda.pdf' })).toBeVisible();
      await expect(publicPage.getByRole('link', { name: 'Download' })).toBeVisible();
    } finally {
      await publicContext.close();
    }
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
