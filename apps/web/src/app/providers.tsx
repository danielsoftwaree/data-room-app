import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';
import { TooltipProvider } from '@repo/ui/components/tooltip';
import { LandingScreen } from '@/features/landing';
import { useAuthTokenBridge } from './use-auth-token-bridge';

const queryClient = new QueryClient();

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/** Wires the Clerk session token into the API client while signed in. */
function AuthTokenBridge({ children }: { children: ReactNode }) {
  useAuthTokenBridge();
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
