import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
} from '@clerk/clerk-react';
import { TooltipProvider } from '@repo/ui/components/tooltip';
import { setAuthTokenGetter } from '@repo/api-client';

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

/** Global app providers (server-state cache, auth, tooltips). */
export function AppProviders({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set');
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SignedIn>
            <AuthTokenBridge>{children}</AuthTokenBridge>
          </SignedIn>
          <SignedOut>
            <div className="flex min-h-screen items-center justify-center">
              <SignIn routing="hash" />
            </div>
          </SignedOut>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
