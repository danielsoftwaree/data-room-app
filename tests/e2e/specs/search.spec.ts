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

test('searches by name via the URL, clears back to the tree, and opens folder results', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Search'));
  const financials = await createFolder(request, dataroom.id, 'Financials');
  const statements = await createFolder(request, dataroom.id, 'Statements', financials.id);
  await uploadPdf(request, dataroom.id, 'Q1 Balance Sheet.pdf', statements.id);
  await uploadPdf(request, dataroom.id, 'Legal Summary.pdf');

  try {
    await page.goto(`/datarooms/${dataroom.id}`);
    const searchInput = page.getByPlaceholder('Search this data room');
    await searchInput.fill('balance');

    // Search state lives in the URL, so it deep-links and survives reload.
    await expect(page).toHaveURL(/q=balance/);
    await expect(rowName(page, 'Q1 Balance Sheet.pdf')).toBeVisible();
    await expect(rowName(page, 'Legal Summary.pdf')).toBeHidden();
    await page.reload();
    await expect(rowName(page, 'Q1 Balance Sheet.pdf')).toBeVisible();

    // Escape clears the search and brings the tree back.
    await searchInput.press('Escape');
    await expect(page).not.toHaveURL(/q=/);
    await expect(rowName(page, 'Financials')).toBeVisible();

    // A folder found by search opens in place.
    await searchInput.fill('statements');
    await openRowViaUi(page, 'Statements');
    await expect(page).toHaveURL(new RegExp(`/folders/${statements.id}`));
    await expect(page.getByRole('heading', { name: 'Statements' })).toBeVisible();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
