import { useQueryClient } from '@tanstack/react-query';
import { useClerk } from '@clerk/clerk-react';
import { useGetMe, useListUsers } from '@repo/api-client';
import type { UserDto } from '@repo/api-client';
import { Avatar, AvatarFallback } from '@repo/ui/components/avatar';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import { LogOutIcon, RotateCcwIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/**
 * Auth is on only when a Clerk key is configured. In that mode the footer shows
 * a real sign-out (Clerk); otherwise the app is in zero-friction demo mode and
 * the footer offers a "reset demo" that wipes local mock state and reloads.
 */
const authEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/**
 * Account menu: shows the current identity and lets you switch demo user or theme.
 * `compact` renders just the avatar (data-room header); otherwise a full row (sidebar).
 */
export function UserMenu({ compact = false }: Readonly<{ compact?: boolean }>) {
  const queryClient = useQueryClient();
  const me = useGetMe();
  const users = useListUsers();
  const current = me.data?.data;

  function switchUser(user: UserDto): void {
    localStorage.setItem('demo-user-id', user.id);
    void queryClient.invalidateQueries();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" aria-label="Account" className="rounded-full">
            <UserAvatar user={current} />
          </Button>
        ) : (
          <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
            <UserAvatar user={current} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold">
                {current?.name ?? 'Demo user'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {current?.email ?? 'Switch identity'}
              </span>
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-64">
        <DropdownMenuLabel>{authEnabled ? 'Account' : 'Demo identity'}</DropdownMenuLabel>
        {authEnabled ? (
          <DropdownMenuItem disabled>
            <UserAvatar user={current} />
            <span className="min-w-0">
              <span className="block truncate">{current?.name ?? 'You'}</span>
              <span className="block truncate text-xs text-muted-foreground">{current?.email}</span>
            </span>
          </DropdownMenuItem>
        ) : (
          (users.data?.data ?? []).map((user) => (
            <DropdownMenuItem key={user.id} onSelect={() => switchUser(user)}>
              <UserAvatar user={user} />
              <span className="min-w-0">
                <span className="block truncate">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1 text-sm">
            <ThemeToggle />
          </div>
          {authEnabled ? <SignOutButton /> : <ResetDemoButton />}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Real sign-out. Only mounted when Clerk is configured, so the hook is safe. */
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
 * (IndexedDB seeds) and reload to a pristine state. Falls back to just clearing
 * the demo identity + cache if the mock helper is not present.
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

export function UserAvatar({ user }: Readonly<{ user: UserDto | undefined }>) {
  return (
    <Avatar className="size-8">
      <AvatarFallback className={cn('text-xs font-bold text-white', avatarColorClass(user?.color))}>
        {initials(user?.name ?? '?')}
      </AvatarFallback>
    </Avatar>
  );
}

function avatarColorClass(color: string | undefined): string {
  const classes: Record<string, string> = {
    '#5865f2': 'bg-primary',
    '#35ed7e': 'bg-emerald-400 text-foreground',
    '#a78bfa': 'bg-violet-400',
    '#f6c956': 'bg-yellow-400 text-foreground',
    '#ec48bd': 'bg-pink-500',
    '#00b0f4': 'bg-sky-500',
  };
  return classes[color ?? ''] ?? 'bg-primary';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
