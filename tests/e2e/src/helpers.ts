import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

export interface DataroomFixture {
  id: string;
  name: string;
}

export interface NodeFixture {
  id: string;
  name: string;
  type: 'folder' | 'file';
}

export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api';

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

export async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await request.fetch(`${API_BASE_URL}${path}`, {
    method,
    data: body,
  });
  if (!response.ok()) {
    throw new Error(`${method} ${path} failed with ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function createDataroom(
  request: APIRequestContext,
  name = uniqueName('E2E Room'),
): Promise<DataroomFixture> {
  return apiJson<DataroomFixture>(request, 'POST', '/datarooms', { name });
}

export async function deleteDataroom(request: APIRequestContext, id: string): Promise<void> {
  const response = await request.delete(`${API_BASE_URL}/datarooms/${id}`);
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`DELETE /datarooms/${id} failed with ${response.status()}`);
  }
}

export async function createFolder(
  request: APIRequestContext,
  dataroomId: string,
  name: string,
  parentId: string | null = null,
): Promise<NodeFixture> {
  return apiJson<NodeFixture>(request, 'POST', `/datarooms/${dataroomId}/folders`, {
    parentId,
    name,
  });
}

export async function uploadPdf(
  request: APIRequestContext,
  dataroomId: string,
  name: string,
  parentId: string | null = null,
): Promise<NodeFixture> {
  const multipart: Record<string, string | ReturnType<typeof pdfFile>> = { file: pdfFile(name) };
  if (parentId !== null) multipart.parentId = parentId;
  const response = await request.post(`${API_BASE_URL}/datarooms/${dataroomId}/files`, {
    multipart,
  });
  if (!response.ok()) {
    throw new Error(`POST /datarooms/${dataroomId}/files failed: ${await response.text()}`);
  }
  return (await response.json()) as NodeFixture;
}

export function pdfFile(name = 'report.pdf') {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
  };
}

export function textFile(name = 'notes.txt') {
  return {
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('plain text'),
  };
}

export async function createFolderViaUi(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Folder name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(rowName(page, name)).toBeVisible();
}

/** The row's name button (the accessible open/preview target). */
export function rowName(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

/** Open a folder or the file viewer the way a user does: double-click the name. */
export async function openRowViaUi(page: Page, name: string): Promise<void> {
  await rowName(page, name).dblclick();
}

export async function renameRowViaUi(
  page: Page,
  currentName: string,
  nextName: string,
): Promise<void> {
  await page.getByLabel(`Actions for ${currentName}`).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByLabel('Name').fill(nextName);
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(rowName(page, nextName)).toBeVisible();
}

/** Move a row to the trash. Deleting is reversible, so there is no confirm step. */
export async function trashRowViaUi(page: Page, name: string): Promise<void> {
  await page.getByLabel(`Actions for ${name}`).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(rowName(page, name)).toBeHidden();
}
