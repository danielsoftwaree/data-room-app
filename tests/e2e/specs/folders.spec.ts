import { expect, test } from '@playwright/test';
import { createDataroom, createFolderViaUi, deleteDataroom, uniqueName } from '../src/helpers';

test('navigates nested folders, survives reload, and moves a subtree to the trash', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Folders'));

  try {
    await page.goto(`/datarooms/${dataroom.id}`);
    await createFolderViaUi(page, 'Root Folder');
    await page.getByRole('link', { name: /Root Folder/ }).click();
    await createFolderViaUi(page, 'Signed');
    await page.getByRole('link', { name: /Signed/ }).click();
    await createFolderViaUi(page, 'Final');
    await page.getByRole('link', { name: /Final/ }).click();

    await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();

    await page.goto(`/datarooms/${dataroom.id}`);
    await page.getByLabel('Actions for Root Folder').click();
    // Deleting moves the whole subtree to the trash immediately - no confirm dialog.
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByText('Root Folder').first()).toBeHidden();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
