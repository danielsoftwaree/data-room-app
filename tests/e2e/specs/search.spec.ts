import { expect, test } from '@playwright/test';
import {
  createDataroom,
  createFolder,
  deleteDataroom,
  uniqueName,
  uploadPdf,
} from '../src/helpers';

test('searches by name, shows result locations, clears back to tree, and opens folder results', async ({
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
    await page.getByPlaceholder('Search files and folders').fill('balance');

    await expect(page).toHaveURL(/q=balance/);
    await expect(page.getByText('Q1 Balance Sheet.pdf').first()).toBeVisible();
    await expect(page.getByText(`${dataroom.name} / Financials / Statements`)).toBeVisible();
    await expect(page.getByText('Legal Summary.pdf')).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByText('Financials').first()).toBeVisible();

    await page.getByPlaceholder('Search files and folders').fill('statements');
    await page.getByRole('link', { name: /^Statements/ }).click();
    await expect(page).toHaveURL(new RegExp(`/folders/${statements.id}$`));
    await expect(page.getByRole('heading', { name: 'Statements' })).toBeVisible();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
