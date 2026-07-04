import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/clerk-react';
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
import { LogOutIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/**
 * Account menu: shows the current identity and lets you switch demo user or theme.
 * `compact` renders just the avatar (data-room header); otherwise a full row (sidebar).
 */
export function UserMenu({ compact = false }: Readonly<{ compact?: boolean }>) {
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const me = useGetMe();
  const users = useListUsers();
  const current = me.data?.data;

  function switchUser(user: UserDto): void {
    localStorage.setItem('demo-user-id', user.id);
    void queryClient.invalidateQueries();
  }

  async function handleSignOut(): Promise<void> {
    localStorage.removeItem('demo-user-id');
    queryClient.clear();
    await signOut();
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
                {clerkUser?.fullName ?? current?.name ?? 'Demo user'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {clerkUser?.primaryEmailAddress?.emailAddress ?? current?.email ?? 'Switch identity'}
              </span>
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-64">
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
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1 text-sm">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Log out"
            title="Sign out"
            onClick={() => void handleSignOut()}
          >
            <LogOutIcon className="size-4" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
