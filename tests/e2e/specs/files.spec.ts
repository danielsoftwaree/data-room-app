import { expect, test } from '@playwright/test';
import {
  createDataroom,
  deleteDataroom,
  openRowViaUi,
  pdfFile,
  renameRowViaUi,
  rowName,
  textFile,
  trashRowViaUi,
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
    await expect(rowName(page, 'report.pdf')).toBeVisible();

    // A same-name upload lands next to the original with a numeric suffix.
    await fileInput.setInputFiles(pdfFile('report.pdf'));
    await expect(rowName(page, 'report (1).pdf')).toBeVisible();

    // Non-PDF files are rejected client-side with a named reason.
    await fileInput.setInputFiles(textFile('notes.txt'));
    await expect(page.getByText(/only PDF files are allowed/i)).toBeVisible();
    await expect(rowName(page, 'notes.txt')).toBeHidden();

    // Double-clicking a file opens the in-app viewer (react-pdf modal).
    await openRowViaUi(page, 'report.pdf');
    const viewer = page.getByRole('dialog');
    await expect(viewer).toContainText('report.pdf');
    await expect(viewer.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();

    await renameRowViaUi(page, 'report.pdf', 'renamed.pdf');
    await trashRowViaUi(page, 'renamed.pdf');
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
