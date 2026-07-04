/**
 * MSW request handlers implementing the Data Room API against the stateful
 * in-memory store. URLs mirror the orval-generated client exactly (prefix /api).
 * Keep this aligned with apps/api controllers/OpenAPI; the real-mode e2e suite
 * is the drift detector when mocks and Nest behavior diverge.
 */
import { http, HttpResponse } from 'msw';
import type { HttpResponseResolver, PathParams } from 'msw';
import * as db from './db';
import { MockError } from './db';

/** ApiErrorResponse-shaped body ({ error: { code, message } }) — same contract as the real API. */
function errorBody(status: number, message: string) {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
  };
  return HttpResponse.json({ error: { code: codes[status] ?? 'ERROR', message } }, { status });
}

/** Wraps a handler so thrown MockErrors become proper HTTP error responses. */
function guard<Params extends PathParams>(
  fn: (info: { request: Request; params: Params }) => Response | Promise<Response>,
): HttpResponseResolver<Params> {
  return async (info) => {
    try {
      return await fn(info);
    } catch (error) {
      if (error instanceof MockError) return errorBody(error.status, error.message);
      const message = error instanceof Error ? error.message : 'Unexpected mock error';
      return errorBody(400, message);
    }
  };
}

// Simulated latency so loading/skeleton states are visible in dev.
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));

function currentUserId(request: Request): string {
  return db.resolveUserId(request.headers.get('x-user-id'));
}

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),

  http.get('/api/me', ({ request }) =>
    HttpResponse.json(db.getMe(request.headers.get('x-user-id'))),
  ),

  http.get('/api/users', () => HttpResponse.json(db.listUsers())),

  http.get(
    '/api/datarooms',
    guard(async () => {
      await delay();
      return HttpResponse.json(db.listDatarooms());
    }),
  ),

  http.post(
    '/api/datarooms',
    guard(async ({ request }) => {
      const body = (await request.json()) as { name: string };
      return HttpResponse.json(db.createDataroom(body?.name, currentUserId(request)), {
        status: 201,
      });
    }),
  ),

  http.get(
    '/api/datarooms/:id',
    guard(async ({ params }) => HttpResponse.json(db.getDataroom(params.id as string))),
  ),

  http.patch(
    '/api/datarooms/:id',
    guard(async ({ params, request }) => {
      const body = (await request.json()) as { name: string };
      return HttpResponse.json(
        db.renameDataroom(params.id as string, body?.name, currentUserId(request)),
      );
    }),
  ),

  http.delete(
    '/api/datarooms/:id',
    guard(async ({ params }) => HttpResponse.json(db.deleteDataroom(params.id as string))),
  ),

  http.get(
    '/api/datarooms/:id/nodes',
    guard(async ({ params, request }) => {
      await delay();
      const search = new URL(request.url).searchParams.get('search') ?? undefined;
      return HttpResponse.json(db.listNodes(params.id as string, { nameContains: search }));
    }),
  ),

  http.post(
    '/api/datarooms/:id/folders',
    guard(async ({ params, request }) => {
      const body = (await request.json()) as { parentId: string | null; name: string };
      return HttpResponse.json(
        db.createFolder(
          params.id as string,
          body?.parentId ?? null,
          body?.name,
          currentUserId(request),
        ),
        { status: 201 },
      );
    }),
  ),

  http.post(
    '/api/datarooms/:id/files',
    guard(async ({ params, request }) => {
      const form = await request.formData();
      const rawParent = form.get('parentId');
      const parentId = typeof rawParent === 'string' && rawParent.length > 0 ? rawParent : null;
      const file = form.get('file');
      if (!(file instanceof File)) throw new MockError(400, 'A PDF file is required');
      const bytes = new Uint8Array(await file.arrayBuffer());
      return HttpResponse.json(
        db.createFile(
          params.id as string,
          parentId,
          {
            originalName: file.name,
            size: file.size,
            contentType: file.type,
            bytes,
          },
          currentUserId(request),
        ),
        { status: 201 },
      );
    }),
  ),

  http.patch(
    '/api/nodes/:id',
    guard(async ({ params, request }) => {
      const body = (await request.json()) as { name: string };
      return HttpResponse.json(
        db.renameNode(params.id as string, body?.name, currentUserId(request)),
      );
    }),
  ),

  http.post(
    '/api/nodes/:id/move',
    guard(async ({ params, request }) => {
      const body = (await request.json()) as { parentId: string | null };
      return HttpResponse.json(
        db.moveNode(params.id as string, body?.parentId ?? null, currentUserId(request)),
      );
    }),
  ),

  http.delete(
    '/api/nodes/:id',
    guard(async ({ params, request }) =>
      HttpResponse.json(db.deleteNode(params.id as string, currentUserId(request))),
    ),
  ),

  http.get(
    '/api/datarooms/:id/members',
    guard(async ({ params }) => HttpResponse.json(db.listMembers(params.id as string))),
  ),

  http.post(
    '/api/datarooms/:id/members',
    guard(async ({ params, request }) => {
      const body = (await request.json()) as {
        userId: string;
        role: 'owner' | 'editor' | 'viewer';
      };
      return HttpResponse.json(
        db.addMember(params.id as string, body.userId, body.role, currentUserId(request)),
        { status: 201 },
      );
    }),
  ),

  http.delete(
    '/api/datarooms/:id/members/:userId',
    guard(async ({ params, request }) => {
      db.removeMember(params.id as string, params.userId as string, currentUserId(request));
      return HttpResponse.json({ ok: true });
    }),
  ),

  http.get(
    '/api/favorites',
    guard(async ({ request }) => HttpResponse.json(db.listFavorites(currentUserId(request)))),
  ),

  http.put(
    '/api/favorites',
    guard(async ({ request }) => {
      const body = (await request.json()) as { dataroomId: string; nodeId?: string | null };
      return HttpResponse.json(
        db.addFavorite(currentUserId(request), body.dataroomId, body.nodeId ?? null),
      );
    }),
  ),

  http.delete(
    '/api/favorites',
    guard(async ({ request }) => {
      const body = (await request.json()) as { dataroomId: string; nodeId?: string | null };
      db.removeFavorite(currentUserId(request), body.dataroomId, body.nodeId ?? null);
      return HttpResponse.json({ ok: true });
    }),
  ),

  http.get(
    '/api/datarooms/:id/activity',
    guard(async ({ params, request }) => {
      const search = new URL(request.url).searchParams;
      return HttpResponse.json(
        db.listActivity(params.id as string, {
          nodeId: search.get('nodeId'),
          limit: Number(search.get('limit') || 25),
        }),
      );
    }),
  ),

  http.get('/api/storage', () => HttpResponse.json(db.getStorageUsage())),

  http.get(
    '/api/nodes/:id/content',
    guard(async ({ params }) => {
      const file = db.getFileContent(params.id as string);
      // TS 5.7+ types Uint8Array over ArrayBufferLike; BlobPart wants ArrayBuffer-backed views.
      const bytes = file.bytes as Uint8Array<ArrayBuffer>;
      const blob = new Blob([bytes], { type: file.contentType });
      // Header values must be Latin-1 (ByteString): a raw non-ASCII filename
      // (e.g. Cyrillic) makes the Response constructor throw, which the guard
      // would surface as a 400. Send an ASCII fallback plus RFC 5987 filename*.
      const asciiName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
      const utf8Name = encodeURIComponent(file.name);
      return new HttpResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        },
      });
    }),
  ),
];
