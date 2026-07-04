/**
 * Postgres unique_violation (23505). drizzle wraps driver errors in
 * DrizzleQueryError with the original pg error in `.cause`, so walk the
 * cause chain instead of checking only the top-level error.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
