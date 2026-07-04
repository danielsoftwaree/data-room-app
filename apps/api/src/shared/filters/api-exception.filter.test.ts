import { describe, expect, test } from 'bun:test';
import { ConflictException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

interface CapturedResponse {
  status?: number;
  body?: unknown;
}

function fakeHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  test('maps HttpException to the ApiErrorResponse shape', () => {
    const captured: CapturedResponse = {};
    filter.catch(new NotFoundException('Data room not found'), fakeHost(captured));
    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Data room not found' },
    });
  });

  test('maps conflict and payload-too-large to their codes', () => {
    const conflict: CapturedResponse = {};
    filter.catch(new ConflictException('duplicate'), fakeHost(conflict));
    expect(conflict.status).toBe(409);
    expect((conflict.body as { error: { code: string } }).error.code).toBe('CONFLICT');

    const tooLarge: CapturedResponse = {};
    filter.catch(new PayloadTooLargeException('too big'), fakeHost(tooLarge));
    expect(tooLarge.status).toBe(413);
    expect((tooLarge.body as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('hides details of unknown errors behind an opaque 500', () => {
    const captured: CapturedResponse = {};
    filter.catch(new Error('secret database string'), fakeHost(captured));
    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });
});
