import { Link } from '@tanstack/react-router';
import { getApiErrorMessage, useListFavorites } from '@repo/api-client';
import type { FavoriteDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { cn } from '@repo/ui/lib/utils';
import { FilePdfIcon, FolderIcon, VaultIcon } from '@phosphor-icons/react';
import { StarIcon } from 'lucide-react';
import { useFavorites } from '../../../shared/favorites';

export function FavoritesScreen() {
  const query = useListFavorites();
  const items = query.data?.data ?? [];
  const favorites = useFavorites();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight uppercase">Favorites</h1>
        <p className="text-sm text-muted-foreground">
          Rooms, folders, and files you’ve starred for quick access.
        </p>
      </header>

      {query.isPending ? (
        <ul className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-[60px] w-full" />
          <Skeleton className="h-[60px] w-full" />
          <Skeleton className="h-[60px] w-full" />
        </ul>
      ) : query.isError ? (
        <EmptyState
          title="Couldn’t load favorites"
          description={getApiErrorMessage(query.error)}
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          description="Star a data room, folder, or file to pin it here and in the sidebar."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((favorite) => (
            <FavoriteRow
              key={`${favorite.dataroomId}:${favorite.nodeId ?? 'room'}`}
              favorite={favorite}
              onUnstar={() => favorites.toggle(favorite.dataroomId, favorite.nodeId)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function FavoriteRow({
  favorite,
  onUnstar,
}: Readonly<{ favorite: FavoriteDto; onUnstar: () => void }>) {
  const label = favorite.nodeName ?? favorite.dataroomName;
  const context =
    favorite.nodeId === null ? 'Data room' : `in ${favorite.dataroomName}`;

  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <FavoriteTargetLink favorite={favorite}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FavoriteIcon favorite={favorite} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium group-hover:underline">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{context}</span>
        </span>
      </FavoriteTargetLink>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove from favorites"
        aria-pressed
        onClick={onUnstar}
      >
        <StarIcon className="size-4 fill-primary text-primary" />
      </Button>
    </li>
  );
}

function FavoriteIcon({ favorite }: Readonly<{ favorite: FavoriteDto }>) {
  if (favorite.nodeId === null) return <VaultIcon weight="fill" className="size-4.5" />;
  if (favorite.nodeType === 'folder')
    return <FolderIcon weight="fill" className="size-4.5 text-primary" />;
  return <FilePdfIcon weight="fill" className="size-4.5 text-destructive" />;
}

const LINK_CLASS = 'flex min-w-0 flex-1 items-center gap-3 outline-none';

/** Navigates to the favorite's target; files preselect via `?select` on arrival. */
function FavoriteTargetLink({
  favorite,
  children,
}: Readonly<{ favorite: FavoriteDto; children: React.ReactNode }>) {
  if (favorite.nodeType === 'folder' && favorite.nodeId) {
    return (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.nodeId }}
        className={LINK_CLASS}
      >
        {children}
      </Link>
    );
  }
  if (favorite.nodeType === 'file' && favorite.nodeId) {
    const select = { select: favorite.nodeId };
    return favorite.parentId ? (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.parentId }}
        search={select}
        className={LINK_CLASS}
      >
        {children}
      </Link>
    ) : (
      <Link
        to="/datarooms/$dataroomId"
        params={{ dataroomId: favorite.dataroomId }}
        search={select}
        className={LINK_CLASS}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/datarooms/$dataroomId"
      params={{ dataroomId: favorite.dataroomId }}
      className={cn(LINK_CLASS)}
    >
      {children}
    </Link>
  );
}
