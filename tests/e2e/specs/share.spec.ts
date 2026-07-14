import { expect, test } from '@playwright/test';
import { createDataroom, deleteDataroom, rowName, uniqueName, uploadPdf } from '../src/helpers';

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

    // Owner opens the share dialog from the row actions and sets a password.
    await page.getByLabel('Actions for shared.pdf').click();
    await page.getByRole('menuitem', { name: /^Share/ }).click();
    const shareDialog = page.getByRole('dialog');
    await shareDialog.getByLabel('Password').fill(password);
    await shareDialog.getByRole('button', { name: 'Create link' }).click();

    // The link is shown read-only once created; extract it for the public visit.
    const shareUrl = await shareDialog.getByLabel('Share link').inputValue();
    expect(shareUrl).toContain('/share/');

    // A fresh, unauthenticated context stands in for an external recipient.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    try {
      await publicPage.goto(shareUrl);
      await expect(
        publicPage.getByRole('heading', { name: /password protected/i }),
      ).toBeVisible();

      // Wrong password is rejected inline.
      await publicPage.getByLabel('Password').fill('not-the-password');
      await publicPage.getByRole('button', { name: 'Unlock' }).click();
      await expect(publicPage.getByText('Incorrect password')).toBeVisible();

      // Correct password reveals the file name and a download affordance.
      await publicPage.getByLabel('Password').fill(password);
      await publicPage.getByRole('button', { name: 'Unlock' }).click();
      await expect(publicPage.getByRole('heading', { name: 'shared.pdf' })).toBeVisible();
      await expect(publicPage.getByRole('link', { name: 'Download' })).toBeVisible();

      // Owner revokes the link back in the app (confirm inside the alert dialog).
      await page.getByRole('button', { name: 'Remove link' }).click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Remove link' })
        .click();
      await expect(page.getByText('Share link removed')).toBeVisible();

      // The public link no longer works: a fresh attempt hits the dead-link state.
      await publicPage.reload();
      await publicPage.getByLabel('Password').fill(password);
      await publicPage.getByRole('button', { name: 'Unlock' }).click();
      await expect(publicPage.getByText(/invalid or has been removed/i)).toBeVisible();
    } finally {
      await publicContext.close();
    }
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
