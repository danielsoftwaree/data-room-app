import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { TooltipProvider } from '@repo/ui/components/tooltip';
import { setAuthTokenGetter } from '@repo/api-client';
import { LandingScreen } from '../features/landing';

const queryClient = new QueryClient();

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/**
 * Registers Clerk's session-token getter with the API client so every
 * generated request carries `Authorization: Bearer <token>`. Kept in one
 * place; generated hooks stay untouched.
 */
function AuthTokenBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return <>{children}</>;
}

/**
 * Global app providers (server-state cache, auth, tooltips).
 *
 * Auth is optional. With a Clerk publishable key we gate the app behind
 * sign-in and show the marketing landing to signed-out visitors. WITHOUT a key
 * the app runs in zero-friction demo mode (MSW mocks + the identity switcher) —
 * no login wall, so an evaluator sees the product immediately.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const inner = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {publishableKey ? (
          <>
            <SignedIn>
              <AuthTokenBridge>{children}</AuthTokenBridge>
            </SignedIn>
            <SignedOut>
              <LandingScreen />
            </SignedOut>
          </>
        ) : (
          children
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );

  if (!publishableKey) return inner;
  return <ClerkProvider publishableKey={publishableKey}>{inner}</ClerkProvider>;
}
