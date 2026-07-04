import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiErrorResponse } from '@repo/contracts';

/** Minimal structural view of the underlying HTTP response (no express types needed). */
interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): unknown;
}

/**
 * Maps every error to the ApiErrorResponse contract ({ error: { code, message } })
 * so clients always parse one shape. Unknown errors become an opaque 500 -
 * details are logged, never leaked.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const { status, code, message } = describe(exception);

    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    const body: ApiErrorResponse = { error: { code, message } };
    response.status(status).json(body);
  }
}

function describe(exception: unknown): { status: number; code: string; message: string } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return { status, code: codeForStatus(status), message: extractMessage(exception) };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong',
  };
}

function extractMessage(exception: HttpException): string {
  const payload = exception.getResponse();
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  }
  return exception.message;
}

function codeForStatus(status: number): string {
  const codes: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
    [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  };
  return codes[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
}
