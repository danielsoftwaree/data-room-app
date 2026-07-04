import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UPLOAD } from '@repo/config';
import { DRIZZLE } from '../config/database/database.tokens';
import { DataroomsModule } from '../modules/datarooms/datarooms.module';
import { DataroomsRepository } from '../modules/datarooms/datarooms.repository';
import { HealthModule } from '../modules/health/health.module';
import { BLOB_STORAGE } from '../modules/storage/blob-storage';
import { ApiExceptionFilter } from '../shared/filters/api-exception.filter';
import { createPdfBuffer } from '../shared/test-utils';
import { FakeBlobStorage, FakeDataroomsRepository } from './fakes';

/** Satisfies the DRIZZLE token that StorageModule/Repository inject; never touched thanks to the overrides. */
@Global()
@Module({ providers: [{ provide: DRIZZLE, useValue: {} }], exports: [DRIZZLE] })
class FakeDatabaseModule {}

/**
 * E2E over the real HTTP layer: controllers, DTO validation, multipart
 * parsing, and the global exception filter all run for real. Only the
 * database repository and blob storage are swapped for in-memory fakes so
 * the suite needs no running PostgreSQL.
 */
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [FakeDatabaseModule, HealthModule, DataroomsModule],
  })
    .overrideProvider(DataroomsRepository)
    .useValue(new FakeDataroomsRepository())
    .overrideProvider(BLOB_STORAGE)
    .useValue(new FakeBlobStorage())
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app.close();
});

function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}/api${path}`, init);
}

function json(path: string, method: string, body: unknown): Promise<Response> {
  return api(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function pdfFormData(fileName = 'report.pdf', parentId?: string): FormData {
  const form = new FormData();
  if (parentId) form.set('parentId', parentId);
  const bytes = createPdfBuffer() as Uint8Array<ArrayBuffer>;
  form.set('file', new File([bytes], fileName, { type: 'application/pdf' }));
  return form;
}

async function createDataroom(name: string): Promise<{ id: string; name: string }> {
  const response = await json('/datarooms', 'POST', { name });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; name: string }>;
}

describe('health', () => {
  test('GET /api/health', async () => {
    const response = await api('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('datarooms API', () => {
  test('full dataroom lifecycle: create, get, rename, delete', async () => {
    const created = await createDataroom('Lifecycle');
    expect(await (await api(`/datarooms/${created.id}`)).json()).toMatchObject({
      name: 'Lifecycle',
    });

    const renamed = await json(`/datarooms/${created.id}`, 'PATCH', { name: 'Renamed' });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({ name: 'Renamed' });

    const deleted = await api(`/datarooms/${created.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ deletedNodeIds: [] });

    const gone = await api(`/datarooms/${created.id}`);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Data room not found' },
    });
  });

  test('409 with contract error shape on duplicate name', async () => {
    await createDataroom('Dupes');
    const response = await json('/datarooms', 'POST', { name: 'dupes' });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('CONFLICT');
  });

  test('400 when the name is not a string (DTO validation)', async () => {
    const response = await json('/datarooms', 'POST', { name: 42 });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  test('400 when the name has forbidden characters', async () => {
    const response = await json('/datarooms', 'POST', { name: 'bad/name' });
    expect(response.status).toBe(400);
  });
});

describe('folders and nodes API', () => {
  test('creates nested folders and lists nodes sorted', async () => {
    const dataroom = await createDataroom('Tree');
    const folder = (await (
      await json(`/datarooms/${dataroom.id}/folders`, 'POST', { parentId: null, name: 'Docs' })
    ).json()) as { id: string };

    const upload = await api(`/datarooms/${dataroom.id}/files`, {
      method: 'POST',
      body: pdfFormData('a.pdf', folder.id),
    });
    expect(upload.status).toBe(201);

    const nodes = (await (await api(`/datarooms/${dataroom.id}/nodes`)).json()) as {
      name: string;
      type: string;
    }[];
    expect(nodes.map((node) => [node.type, node.name])).toEqual([
      ['folder', 'Docs'],
      ['file', 'a.pdf'],
    ]);
  });

  test('404 for a parent from nowhere and 400 for a file parent', async () => {
    const dataroom = await createDataroom('Parents');
    const missing = await json(`/datarooms/${dataroom.id}/folders`, 'POST', {
      parentId: '00000000-0000-0000-0000-000000000000',
      name: 'X',
    });
    expect(missing.status).toBe(404);

    const uploaded = (await (
      await api(`/datarooms/${dataroom.id}/files`, { method: 'POST', body: pdfFormData() })
    ).json()) as { id: string };
    const underFile = await json(`/datarooms/${dataroom.id}/folders`, 'POST', {
      parentId: uploaded.id,
      name: 'X',
    });
    expect(underFile.status).toBe(400);
  });

  test('rename conflicts inside the same folder produce 409', async () => {
    const dataroom = await createDataroom('Renames');
    await json(`/datarooms/${dataroom.id}/folders`, 'POST', { parentId: null, name: 'A' });
    const second = (await (
      await json(`/datarooms/${dataroom.id}/folders`, 'POST', { parentId: null, name: 'B' })
    ).json()) as { id: string };

    const conflict = await json(`/nodes/${second.id}`, 'PATCH', { name: 'a' });
    expect(conflict.status).toBe(409);
  });

  test('deleting a folder cascades and reports all subtree ids', async () => {
    const dataroom = await createDataroom('Cascade');
    const folder = (await (
      await json(`/datarooms/${dataroom.id}/folders`, 'POST', { parentId: null, name: 'Root' })
    ).json()) as { id: string };
    const file = (await (
      await api(`/datarooms/${dataroom.id}/files`, {
        method: 'POST',
        body: pdfFormData('inner.pdf', folder.id),
      })
    ).json()) as { id: string };

    const response = await api(`/nodes/${folder.id}`, { method: 'DELETE' });
    const body = (await response.json()) as { deletedIds: string[] };
    expect(body.deletedIds.sort()).toEqual([folder.id, file.id].sort());

    expect((await api(`/nodes/${file.id}/content`)).status).toBe(404);
  });
});

describe('file upload and download API', () => {
  test('uploads a PDF and downloads identical bytes with headers', async () => {
    const dataroom = await createDataroom('Files');
    const uploaded = (await (
      await api(`/datarooms/${dataroom.id}/files`, { method: 'POST', body: pdfFormData() })
    ).json()) as { id: string; name: string; size: number };
    expect(uploaded.name).toBe('report.pdf');

    const download = await api(`/nodes/${uploaded.id}/content`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toContain('application/pdf');
    expect(download.headers.get('content-disposition')).toContain('report.pdf');
    const bytes = Buffer.from(await download.arrayBuffer());
    expect(bytes.equals(createPdfBuffer())).toBe(true);
  });

  test('auto-suffixes duplicate names at the API level', async () => {
    const dataroom = await createDataroom('Suffixes');
    await api(`/datarooms/${dataroom.id}/files`, { method: 'POST', body: pdfFormData() });
    const second = (await (
      await api(`/datarooms/${dataroom.id}/files`, { method: 'POST', body: pdfFormData() })
    ).json()) as { name: string };
    expect(second.name).toBe('report (1).pdf');
  });

  test('400 for a non-PDF payload with the contract error shape', async () => {
    const dataroom = await createDataroom('Rejects');
    const form = new FormData();
    form.set(
      'file',
      new File([new TextEncoder().encode('plain text')], 'notes.txt', { type: 'text/plain' }),
    );
    const response = await api(`/datarooms/${dataroom.id}/files`, { method: 'POST', body: form });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  test('400 when no file part is sent', async () => {
    const dataroom = await createDataroom('Empty');
    const response = await api(`/datarooms/${dataroom.id}/files`, {
      method: 'POST',
      body: new FormData(),
    });
    expect(response.status).toBe(400);
  });

  test('413 when the multipart file exceeds the configured limit', async () => {
    const dataroom = await createDataroom('TooBig');
    const oversized = Buffer.alloc(UPLOAD.maxFileSizeBytes + 1024, 0x25);
    oversized.write('%PDF-1.4\n');
    const form = new FormData();
    form.set(
      'file',
      new File([oversized as unknown as Uint8Array<ArrayBuffer>], 'big.pdf', {
        type: 'application/pdf',
      }),
    );
    const response = await api(`/datarooms/${dataroom.id}/files`, { method: 'POST', body: form });
    expect(response.status).toBe(413);
  }, 30_000);
});
