import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useGetMe, useListUsers } from '@repo/api-client';
import type { UserDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { LogOutIcon, RotateCcwIcon } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { UserAvatar } from './user-avatar';

/**
 * Auth is on only when a Clerk key is configured. `authEnabled` is a build-time
 * constant, so branching the whole menu on it is safe for the rules of hooks:
 * each variant calls its own hooks unconditionally.
 */
const authEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/** Account menu. `compact` renders just the avatar (data-room header). */
export function UserMenu(props: Readonly<{ compact?: boolean }>) {
  return authEnabled ? <AuthUserMenu {...props} /> : <DemoUserMenu {...props} />;
}

/**
 * Authenticated identity comes straight from Clerk (name + email are always
 * present there), so the display never depends on the API's provisioned row.
 * The DB-provisioned colour is still used to tint the avatar.
 */
function AuthUserMenu({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { user } = useUser();
  const me = useGetMe();
  const name = user?.fullName ?? user?.username ?? 'You';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const identity: UserDto | undefined = me.data?.data
    ? { ...me.data.data, name, email }
    : { id: user?.id ?? '', name, email, color: '#5865f2' };

  return (
    <MenuShell compact={compact} identity={identity} footer={<SignOutButton />}>
      <DropdownMenuLabel>Account</DropdownMenuLabel>
      <DropdownMenuItem disabled>
        <UserAvatar user={identity} />
        <span className="min-w-0">
          <span className="block truncate">{name}</span>
          {email ? (
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          ) : null}
        </span>
      </DropdownMenuItem>
    </MenuShell>
  );
}

/** Demo mode: no session, but you can switch between seeded identities. */
function DemoUserMenu({ compact = false }: Readonly<{ compact?: boolean }>) {
  const queryClient = useQueryClient();
  const me = useGetMe();
  const users = useListUsers();
  const current = me.data?.data;

  function switchUser(user: UserDto): void {
    localStorage.setItem('demo-user-id', user.id);
    void queryClient.invalidateQueries();
  }

  return (
    <MenuShell compact={compact} identity={current} footer={<ResetDemoButton />}>
      <DropdownMenuLabel>Demo identity</DropdownMenuLabel>
      {(users.data?.data ?? []).map((user) => (
        <DropdownMenuItem key={user.id} onSelect={() => switchUser(user)}>
          <UserAvatar user={user} />
          <span className="min-w-0">
            <span className="block truncate">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuItem>
      ))}
    </MenuShell>
  );
}

/** Shared trigger + dropdown chrome; variants supply the list body and footer. */
function MenuShell({
  compact,
  identity,
  children,
  footer,
}: Readonly<{
  compact: boolean;
  identity: UserDto | undefined;
  children: ReactNode;
  footer: ReactNode;
}>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" aria-label="Account" className="rounded-full">
            <UserAvatar user={identity} />
          </Button>
        ) : (
          <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
            <UserAvatar user={identity} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold">
                {identity?.name ?? 'You'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {identity?.email ?? ''}
              </span>
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-64">
        {children}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1 text-sm">
            <ThemeToggle />
          </div>
          {footer}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Real sign-out. Only mounted in auth mode, so the Clerk hook is safe. */
function SignOutButton() {
  const { signOut } = useClerk();
  const queryClient = useQueryClient();

  async function handleSignOut(): Promise<void> {
    localStorage.removeItem('demo-user-id');
    queryClient.clear();
    await signOut();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Log out"
      title="Sign out"
      onClick={() => void handleSignOut()}
    >
      <LogOutIcon className="size-4" />
    </Button>
  );
}

/**
 * Demo-mode "exit": there is no session to end, so reset the local mock data
 * (IndexedDB seeds) and reload to a pristine state.
 */
function ResetDemoButton() {
  const queryClient = useQueryClient();

  async function handleReset(): Promise<void> {
    localStorage.removeItem('demo-user-id');
    queryClient.clear();
    await window.__dataroomMocks?.reset();
    window.location.reload();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Reset demo"
      title="Reset demo data"
      onClick={() => void handleReset()}
    >
      <RotateCcwIcon className="size-4" />
    </Button>
  );
}
