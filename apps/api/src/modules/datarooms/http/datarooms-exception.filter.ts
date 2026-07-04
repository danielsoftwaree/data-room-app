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
  return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' };
}
