import { expect, test } from '@playwright/test';
import {
  createDataroom,
  createFolderViaUi,
  deleteDataroom,
  openRowViaUi,
  trashRowViaUi,
  uniqueName,
} from '../src/helpers';

test('navigates nested folders, survives reload, and moves a subtree to the trash', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Folders'));

  try {
    await page.goto(`/datarooms/${dataroom.id}`);
    await createFolderViaUi(page, 'Root Folder');
    await openRowViaUi(page, 'Root Folder');
    await createFolderViaUi(page, 'Signed');
    await openRowViaUi(page, 'Signed');
    await createFolderViaUi(page, 'Final');
    await openRowViaUi(page, 'Final');

    await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();

    // Breadcrumbs link back up the ancestor chain.
    await page.getByRole('link', { name: 'Signed' }).click();
    await expect(page.getByRole('heading', { name: 'Signed' })).toBeVisible();

    await page.goto(`/datarooms/${dataroom.id}`);
    await trashRowViaUi(page, 'Root Folder');
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
