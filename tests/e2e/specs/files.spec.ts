import { expect, test } from '@playwright/test';
import {
  createDataroom,
  deleteDataroom,
  pdfFile,
  renameRowViaUi,
  textFile,
  uniqueName,
} from '../src/helpers';

test('uploads, views, renames, rejects non-PDF, suffixes duplicates, and deletes files', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Files'));
  const fileInput = page.locator('input[type="file"]');

  try {
    await page.goto(`/datarooms/${dataroom.id}`);
    await fileInput.setInputFiles(pdfFile('report.pdf'));
    await expect(page.getByText('report.pdf').first()).toBeVisible();

    await fileInput.setInputFiles(pdfFile('report.pdf'));
    await expect(page.getByText('report (1).pdf').first()).toBeVisible();

    await fileInput.setInputFiles(textFile('notes.txt'));
    await expect(page.getByText(/only PDF files are allowed/i)).toBeVisible();
    await expect(page.getByText('notes.txt')).toHaveCount(0);

    await page.getByRole('button', { name: /^report\.pdf/ }).click();
    await expect(page.getByRole('dialog')).toContainText('report.pdf');
    await expect(page.locator('iframe[title="report.pdf"]')).toBeVisible();
    await page.keyboard.press('Escape');

    await renameRowViaUi(page, 'report.pdf', 'renamed.pdf');
    await page.getByLabel('Actions for renamed.pdf').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('renamed.pdf').first()).toBeHidden();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
