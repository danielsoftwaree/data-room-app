import { useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { getApiErrorMessage, useListFavorites, useListTrash } from '@repo/api-client';
import type { FavoriteDto } from '@repo/api-client';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import { FilePdfIcon, FolderIcon, VaultIcon } from '@phosphor-icons/react';
import { LayoutGridIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { CreateDataroomDialog } from '@/features/datarooms';
import { FavoriteLink, favoriteKey } from '@/features/favorites';
import { StorageUsageCard } from '@/shared/components/storage-usage-card';
import { UserMenu } from '@/shared/components/user-menu';

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
 * Navigation content shared by the desktop rail and the mobile drawer.
 * `onNavigate` is invoked when the user triggers navigation so the mobile
 * drawer can close; on desktop it is a no-op.
 */
export function SidebarBody({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const favorites = useListFavorites();
  const trash = useListTrash();
  const trashCount = trash.data?.data.length ?? 0;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Link to="/" onClick={onNavigate} className="flex h-16 items-center gap-3 border-b px-5">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <VaultIcon weight="fill" className="size-5" />
        </span>
        <span className="font-display text-base font-extrabold tracking-tight">Data Room</span>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <Button className="w-full justify-start" onClick={() => setCreateOpen(true)}>
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
                {favorites.data.data.slice(0, FAVORITES_PREVIEW).map((favorite) => (
                  <SidebarFavorite
                    key={favoriteKey(favorite.dataroomId, favorite.nodeId)}
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

        <StorageUsageCard className="mt-auto rounded-lg border bg-background/60 p-3" />
      </div>

      <div className="border-t p-4">
        <UserMenu />
      </div>

      <CreateDataroomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(dataroom) => {
          onNavigate?.();
          void navigate({ to: '/datarooms/$dataroomId', params: { dataroomId: dataroom.id } });
        }}
      />
    </div>
  );
}

/** Compact favorite entry: icon by target kind, label, navigate-on-click. */
function SidebarFavorite({
  favorite,
  onNavigate,
}: Readonly<{ favorite: FavoriteDto; onNavigate?: () => void }>) {
  return (
    <FavoriteLink
      favorite={favorite}
      onNavigate={onNavigate}
      className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {favorite.nodeId === null ? (
        <VaultIcon weight="fill" className="size-4" />
      ) : favorite.nodeType === 'folder' ? (
        <FolderIcon className="size-4" />
      ) : (
        <FilePdfIcon weight="fill" className="size-4" />
      )}
      <span className="truncate">{favorite.nodeName ?? favorite.dataroomName}</span>
    </FavoriteLink>
  );
}
