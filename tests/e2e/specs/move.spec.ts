import { expect, test } from '@playwright/test';
import {
  createDataroom,
  createFolder,
  deleteDataroom,
  openRowViaUi,
  rowName,
  uniqueName,
  uploadPdf,
} from '../src/helpers';

test('moves a file between folders and blocks moving a folder into its own subtree', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Move'));
  const folderA = await createFolder(request, dataroom.id, 'Folder A');
  await createFolder(request, dataroom.id, 'Folder B');
  await createFolder(request, dataroom.id, 'Sub', folderA.id);
  await uploadPdf(request, dataroom.id, 'contract.pdf', folderA.id);

  try {
    // Move the file A → B through the move dialog.
    await page.goto(`/datarooms/${dataroom.id}/folders/${folderA.id}`);
    await page.getByLabel('Actions for contract.pdf').click();
    await page.getByRole('menuitem', { name: 'Move' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Folder B' }).click();
    await dialog.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(rowName(page, 'contract.pdf')).toBeHidden();

    await page.goto(`/datarooms/${dataroom.id}`);
    await openRowViaUi(page, 'Folder B');
    await expect(rowName(page, 'contract.pdf')).toBeVisible();

    // A folder cannot move into itself or its own descendant — those targets
    // are disabled, as is its current parent (a no-op move).
    await page.goto(`/datarooms/${dataroom.id}`);
    await page.getByLabel('Actions for Folder A').click();
    await page.getByRole('menuitem', { name: 'Move' }).click();
    const moveDialog = page.getByRole('dialog');
    await expect(moveDialog.getByRole('button', { name: 'Folder A' })).toBeDisabled();
    await expect(moveDialog.getByRole('button', { name: 'Sub' })).toBeDisabled();
    await expect(moveDialog.getByRole('button', { name: 'Data room root' })).toBeDisabled();
    await expect(moveDialog.getByRole('button', { name: 'Folder B' })).toBeEnabled();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
