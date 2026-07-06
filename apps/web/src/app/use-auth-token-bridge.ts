import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from '@repo/api-client';

/**
 * Registers Clerk's session-token getter with the API client so every
 * generated request carries `Authorization: Bearer <token>`. Kept in one
 * place; generated hooks stay untouched. Must be mounted inside <SignedIn>.
 *
 * The raw `useEffect` is allowed here — external-system sync inside a
 * reusable hook is the one sanctioned home for it (no-use-effect rule).
 */
export function useAuthTokenBridge(): void {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
}
