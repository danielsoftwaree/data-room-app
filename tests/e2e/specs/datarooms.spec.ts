import { expect, test } from '@playwright/test';
import { apiJson, deleteDataroom, uniqueName } from '../src/helpers';

test('creates, renames, blocks duplicate names, and deletes a data room', async ({
  page,
  request,
}) => {
  const createdIds: string[] = [];
  const name = uniqueName('E2E Deal');
  const renamed = `${name} Renamed`;

  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'New data room' }).click();
    await page.getByLabel('Data room name').fill(name);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    const rooms = await apiJson<{ id: string; name: string }[]>(request, 'GET', '/datarooms');
    const created = rooms.find((room) => room.name === name);
    expect(created).toBeDefined();
    createdIds.push(created!.id);

    await page.getByRole('button', { name: 'New data room' }).click();
    await page.getByLabel('Data room name').fill(name.toLocaleLowerCase());
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByLabel(`Actions for ${name}`).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.getByLabel('Data room name').fill(renamed);
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByText(renamed).first()).toBeVisible();

    await page.getByLabel(`Actions for ${renamed}`).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(renamed).first()).toBeHidden();
  } finally {
    for (const id of createdIds) await deleteDataroom(request, id);
  }
});
