import { expect, test } from '@playwright/test';
import { createDataroom, deleteDataroom, uniqueName, uploadPdf } from '../src/helpers';

test('starring a file pins it to the sidebar and the star deep-links back to it', async ({
  page,
  request,
}) => {
  const dataroom = await createDataroom(request, uniqueName('E2E Favs'));
  const fileName = `${uniqueName('pitch')}.pdf`;
  await uploadPdf(request, dataroom.id, fileName);

  try {
    await page.goto(`/datarooms/${dataroom.id}`);
    const row = page.locator(`[data-node-id]`, { hasText: fileName });
    await row.getByLabel('Add to favorites').click();
    await expect(row.getByLabel('Remove from favorites')).toBeVisible();

    // The sidebar favorites list links straight to the node.
    const sidebarLink = page.getByRole('link', { name: fileName });
    await expect(sidebarLink).toBeVisible();
    await sidebarLink.click();
    await expect(page).toHaveURL(new RegExp(`/datarooms/${dataroom.id}`));

    // Unstar → it leaves the sidebar.
    await row.getByLabel('Remove from favorites').click();
    await expect(page.getByRole('link', { name: fileName })).toBeHidden();
  } finally {
    await deleteDataroom(request, dataroom.id);
  }
});
