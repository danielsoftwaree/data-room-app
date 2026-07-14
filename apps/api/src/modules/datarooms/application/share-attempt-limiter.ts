import { Injectable } from '@nestjs/common';
import { ShareRateLimitedError } from '../domain/errors';

/** Max failed unlock attempts allowed within one window before locking out. */
const MAX_FAILURES = 10;
const WINDOW_MS = 60_000;

interface Attempts {
  count: number;
  windowStart: number;
}

/**
 * Throttles password guessing on public share links: at most 10 failed attempts
 * per slug per 60s (fixed window), a success clears the counter. Checked before
 * verifying and incremented only on a wrong password — an unknown slug (404)
 * never counts.
 *
 * ponytail: state is an in-memory Map, so the window is per-process. That is fine
 * for the single API instance we run today; if the API ever scales horizontally,
 * move this to a shared store (e.g. Redis) so the limit holds across instances.
 */
@Injectable()
export class ShareAttemptLimiter {
  private readonly attempts = new Map<string, Attempts>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Throws ShareRateLimitedError when the slug is currently locked out. */
  assertWithinLimit(slug: string): void {
    const entry = this.attempts.get(slug);
    if (!entry) return;
    if (this.now() - entry.windowStart >= WINDOW_MS) {
      this.attempts.delete(slug);
      return;
    }
    if (entry.count >= MAX_FAILURES) throw new ShareRateLimitedError();
  }

  recordFailure(slug: string): void {
    const now = this.now();
    const entry = this.attempts.get(slug);
    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      this.attempts.set(slug, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
  }

  /** Clears the counter for a slug after a successful unlock. */
  clear(slug: string): void {
    this.attempts.delete(slug);
  }
}
