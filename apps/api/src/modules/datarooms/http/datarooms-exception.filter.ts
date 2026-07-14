import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiErrorResponse } from '@repo/contracts';
import { DataroomModuleError } from '../domain/errors';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): unknown;
}

@Catch(DataroomModuleError)
export class DataroomsExceptionFilter implements ExceptionFilter {
  catch(exception: DataroomModuleError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const { status, code } = describe(exception);
    const body: ApiErrorResponse = { error: { code, message: exception.message } };
    response.status(status).json(body);
  }
}

function describe(error: DataroomModuleError): { status: number; code: string } {
  if (error.kind === 'name-conflict') {
    return { status: HttpStatus.CONFLICT, code: 'CONFLICT' };
  }
  if (error.kind === 'invalid-input') {
    return { status: HttpStatus.BAD_REQUEST, code: 'BAD_REQUEST' };
  }
  if (error.kind === 'payload-too-large') {
    return { status: HttpStatus.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE' };
  }
  if (error.kind === 'share-not-found') {
    return { status: HttpStatus.NOT_FOUND, code: 'SHARE_NOT_FOUND' };
  }
  if (error.kind === 'share-password-required') {
    return { status: HttpStatus.UNAUTHORIZED, code: 'SHARE_PASSWORD_REQUIRED' };
  }
  if (error.kind === 'invalid-share-password') {
    return { status: HttpStatus.UNAUTHORIZED, code: 'INVALID_SHARE_PASSWORD' };
  }
  if (error.kind === 'share-rate-limited') {
    return { status: HttpStatus.TOO_MANY_REQUESTS, code: 'SHARE_RATE_LIMITED' };
  }
  return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' };
}
