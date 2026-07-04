import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  getApiErrorMessage,
  useGetStorageUsage,
  useListDatarooms,
  useListFavorites,
  useListTrash,
} from '@repo/api-client';
import type { FavoriteDto } from '@repo/api-client';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Progress } from '@repo/ui/components/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet';
import { Skeleton } from '@repo/ui/components/skeleton';
import { cn } from '@repo/ui/lib/utils';
import { FilePdfIcon, FolderIcon, VaultIcon } from '@phosphor-icons/react';
import {
  HardDriveIcon,
  LayoutGridIcon,
  MenuIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NameDialog } from '../../../shared/NameDialog';
import { UserMenu } from '../../../shared/UserMenu';
import { formatFileSize } from '../../../shared/format';
import { useCreateDataroom } from '../../datarooms/hooks';

type NavTo = '/' | '/favorites' | '/trash';

type NavItem = {
  label: string;
  icon: typeof LayoutGridIcon;
  to: NavTo;
};

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Data Rooms', icon: LayoutGridIcon, to: '/' },
  { label: 'Favorites', icon: StarIcon, to: '/favorites' },
  { label: 'Trash', icon: Trash2Icon, to: '/trash' },
] as const;

const FAVORITES_PREVIEW = 6;

/**
 * App navigation. Renders as a fixed rail on desktop (lg+) and as a hamburger
 * that opens an off-canvas drawer on mobile. The nav body is shared between
 * both via {@link SidebarBody}; `onNavigate` lets the mobile drawer close
 * itself when the user picks a destination.
 */
export function AppSidebar() {
  return (
    <>
      <MobileTopBar />
      <aside className="sticky top-0 z-20 hidden h-screen w-[248px] shrink-0 flex-col border-r bg-card lg:flex">
        <SidebarBody />
      </aside>
    </>
  );
}

function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Close the drawer on any route change (covers favorite links, back/forward, etc.).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <MenuIcon className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Data rooms, favorites, trash and account
          </SheetDescription>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Link to="/" className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <VaultIcon weight="fill" className="size-4" />
        </span>
        <span className="font-display text-base font-extrabold tracking-tight">Data Room</span>
      </Link>

      <div className="ml-auto">
        <UserMenu compact />
      </div>
    </header>
  );
}

/**
 * Shared navigation content used by both the desktop rail and the mobile
 * drawer. `onNavigate` is invoked when the user triggers navigation so the
 * mobile drawer can close; on desktop it is a no-op.
 */
function SidebarBody({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const datarooms = useListDatarooms();
  const rooms = datarooms.data?.data ?? [];
  const favorites = useListFavorites();
  const trash = useListTrash();
  const trashCount = trash.data?.data.length ?? 0;
  const storage = useGetStorageUsage();
  const createDataroom = useCreateDataroom();
  const [createOpen, setCreateOpen] = useState(false);

  const storageUsage = storage.data?.data;
  const percent = storageUsage
    ? Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.quotaBytes) * 100))
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Link to="/" onClick={onNavigate} className="flex h-16 items-center gap-3 border-b px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <VaultIcon weight="fill" className="size-5" />
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
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.to === '/trash' && trashCount > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {trashCount}
                  </Badge>
                ) : null}
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
              <>
                {favorites.data.data
                  .slice(0, FAVORITES_PREVIEW)
                  .map((favorite) => (
                    <FavoriteLink
                      key={favoriteKey(favorite)}
                      favorite={favorite}
                      onNavigate={onNavigate}
                    />
                  ))}
                {favorites.data.data.length > FAVORITES_PREVIEW ? (
                  <Link
                    to="/favorites"
                    onClick={onNavigate}
                    className="px-2 py-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    View all {favorites.data.data.length}
                  </Link>
                ) : null}
              </>
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
        <UserMenu />
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
                onNavigate?.();
                void navigate({
                  to: '/datarooms/$dataroomId',
                  params: { dataroomId: response.data.id },
                });
              },
            },
          )
        }
      />
    </div>
  );
}

function FavoriteLink({
  favorite,
  onNavigate,
}: Readonly<{ favorite: FavoriteDto; onNavigate?: () => void }>) {
  const label = favorite.nodeName ?? favorite.dataroomName;
  const Icon =
    favorite.nodeId === null
      ? VaultIcon
      : favorite.nodeType === 'folder'
        ? FolderIcon
        : FilePdfIcon;
  const className =
    'flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground';
  if (favorite.nodeType === 'folder' && favorite.nodeId) {
    return (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.nodeId }}
        onClick={onNavigate}
        className={className}
      >
        <Icon className="size-4" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }
  // A favorited file opens its containing folder (or the room root) with the file
  // preselected via ?select, so it is scrolled to and highlighted on arrival.
  const select = favorite.nodeType === 'file' && favorite.nodeId ? { select: favorite.nodeId } : {};
  if (favorite.nodeType === 'file' && favorite.parentId) {
    return (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.parentId }}
        search={select}
        onClick={onNavigate}
        className={className}
      >
        <Icon weight="fill" className="size-4" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }
  return (
    <Link
      to="/datarooms/$dataroomId"
      params={{ dataroomId: favorite.dataroomId }}
      search={select}
      onClick={onNavigate}
      className={className}
    >
      <Icon weight="fill" className="size-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function favoriteKey(favorite: FavoriteDto): string {
  return `${favorite.dataroomId}:${favorite.nodeId ?? 'room'}`;
}
