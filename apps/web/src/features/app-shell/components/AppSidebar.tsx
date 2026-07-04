import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  useGetMe,
  useGetStorageUsage,
  useListDatarooms,
  useListFavorites,
  useListUsers,
} from '@repo/api-client';
import type { FavoriteDto, UserDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { Progress } from '@repo/ui/components/progress';
import { Skeleton } from '@repo/ui/components/skeleton';
import { cn } from '@repo/ui/lib/utils';
import {
  ArchiveIcon,
  DatabaseIcon,
  FolderIcon,
  HardDriveIcon,
  LayoutGridIcon,
  PlusIcon,
  StarIcon,
} from 'lucide-react';
import { useState } from 'react';
import { NameDialog } from '../../../shared/NameDialog';
import { ThemeToggle } from '../../../shared/ThemeToggle';
import { formatFileSize } from '../../../shared/format';
import { useCreateDataroom } from '../../datarooms/hooks';

type NavItem = {
  label: string;
  icon: typeof LayoutGridIcon;
  to: '/';
};

/** Only shipped destinations: the brief calls for no unimplemented features. */
const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Data Rooms', icon: LayoutGridIcon, to: '/' },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const datarooms = useListDatarooms();
  const rooms = datarooms.data?.data ?? [];
  const favorites = useListFavorites();
  const storage = useGetStorageUsage();
  const me = useGetMe();
  const users = useListUsers();
  const createDataroom = useCreateDataroom();
  const [createOpen, setCreateOpen] = useState(false);

  const storageUsage = storage.data?.data;
  const percent = storageUsage
    ? Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.quotaBytes) * 100))
    : 0;

  function switchUser(user: UserDto): void {
    localStorage.setItem('demo-user-id', user.id);
    void queryClient.invalidateQueries();
  }

  return (
    <aside className="sticky top-0 z-20 flex max-h-[28rem] w-full shrink-0 flex-col border-b bg-card lg:h-screen lg:max-h-none lg:w-[248px] lg:border-r lg:border-b-0">
      <Link to="/" className="flex h-16 items-center gap-3 border-b px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <DatabaseIcon className="size-5" />
        </span>
        <span className="font-display text-base font-extrabold tracking-tight">Data Room</span>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <Button
          className="w-full justify-start"
          onClick={() => {
            createDataroom.reset();
            setCreateOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          New Data Room
        </Button>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.to === '/' && pathname === '/';
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t pt-4">
          <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Favorites
          </p>
          <div className="flex flex-col gap-1">
            {favorites.isPending ? (
              <p className="px-1 text-sm text-muted-foreground">Loading...</p>
            ) : favorites.isError ? (
              <p className="px-1 text-sm text-destructive">{getApiErrorMessage(favorites.error)}</p>
            ) : favorites.data.data.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No favorites yet</p>
            ) : (
              favorites.data.data
                .slice(0, 6)
                .map((favorite) => <FavoriteLink key={favoriteKey(favorite)} favorite={favorite} />)
            )}
          </div>
        </div>

        <div className="mt-auto rounded-lg border bg-background/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <HardDriveIcon className="size-4 text-muted-foreground" />
            Storage
          </div>
          {storageUsage ? (
            <p className="mb-2 text-xs text-muted-foreground">
              {formatFileSize(storageUsage.usedBytes)} of {formatFileSize(storageUsage.quotaBytes)}{' '}
              used
            </p>
          ) : (
            <Skeleton className="mb-2 h-4 w-28" />
          )}
          <Progress value={percent} />
        </div>
      </div>

      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
              <UserAvatar user={me.data?.data} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">
                  {me.data?.data.name ?? 'Demo user'}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {me.data?.data.email ?? 'Switch identity'}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
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
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <ThemeToggle />
              Theme
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <NameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New data room"
        label="Data room name"
        submitLabel="Create"
        placeholder="e.g. Project Titan - Due Diligence"
        existingNames={rooms.map((room) => room.name)}
        pending={createDataroom.isPending}
        serverError={createDataroom.isError ? getApiErrorMessage(createDataroom.error) : null}
        onSubmit={(name) =>
          createDataroom.mutate(
            { data: { name } },
            {
              onSuccess: (response) => {
                setCreateOpen(false);
                void navigate({
                  to: '/datarooms/$dataroomId',
                  params: { dataroomId: response.data.id },
                });
              },
            },
          )
        }
      />
    </aside>
  );
}

function FavoriteLink({ favorite }: Readonly<{ favorite: FavoriteDto }>) {
  const label = favorite.nodeName ?? favorite.dataroomName;
  const icon =
    favorite.nodeId === null ? StarIcon : favorite.nodeType === 'folder' ? FolderIcon : ArchiveIcon;
  const Icon = icon;
  const className =
    'flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground';
  if (favorite.nodeType === 'folder' && favorite.nodeId) {
    return (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.nodeId }}
        className={className}
      >
        <Icon className="size-4" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }
  return (
    <Link
      to={
        favorite.nodeType === 'file' && favorite.parentId
          ? '/datarooms/$dataroomId/folders/$folderId'
          : '/datarooms/$dataroomId'
      }
      params={
        favorite.nodeType === 'file' && favorite.parentId
          ? { dataroomId: favorite.dataroomId, folderId: favorite.parentId }
          : { dataroomId: favorite.dataroomId }
      }
      className={className}
    >
      <Icon className="size-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function UserAvatar({ user }: Readonly<{ user: UserDto | undefined }>) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white',
        avatarColorClass(user?.color),
      )}
    >
      {initials(user?.name ?? '?')}
    </span>
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

function favoriteKey(favorite: FavoriteDto): string {
  return `${favorite.dataroomId}:${favorite.nodeId ?? 'room'}`;
}
