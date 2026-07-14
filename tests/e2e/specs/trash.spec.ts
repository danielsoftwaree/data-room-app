import { expect, test } from '@playwright/test';
import {
  createDataroom,
  deleteDataroom,
  rowName,
  trashRowViaUi,
  uniqueName,
  uploadPdf,
} from '../src/helpers';

test('trashed items can be undone, restored from the Trash, and purged forever', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Trash'));
  const fileName = `${uniqueName('contract')}.pdf`;
  await uploadPdf(request, dataroom.id, fileName);

  try {
    await page.goto(`/datarooms/${dataroom.id}`);

    // Delete → the Undo toast brings it straight back.
    await trashRowViaUi(page, fileName);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(rowName(page, fileName)).toBeVisible();

    // Delete again → restore from the Trash screen.
    await trashRowViaUi(page, fileName);
    await page.goto('/trash');
    const trashRow = page.locator('li', { hasText: fileName });
    await expect(trashRow).toBeVisible();
    await trashRow.getByRole('button', { name: 'Restore' }).click();
    await expect(trashRow).toBeHidden();
    await page.goto(`/datarooms/${dataroom.id}`);
    await expect(rowName(page, fileName)).toBeVisible();

    // Delete once more → purge forever needs an explicit confirmation.
    await trashRowViaUi(page, fileName);
    await page.goto('/trash');
    await page.getByLabel(`Delete ${fileName} forever`).click();
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.getByText(fileName)).toBeHidden();
    await page.goto(`/datarooms/${dataroom.id}`);
    await expect(rowName(page, fileName)).toBeHidden();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
