import { SetMetadata } from '@nestjs/common';

/** Marker key read by ClerkAuthGuard to skip token verification. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts an endpoint out of authentication (e.g. health checks). Handlers without
 * this decorator require a valid Clerk bearer token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
