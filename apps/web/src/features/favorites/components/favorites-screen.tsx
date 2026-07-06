import { getApiErrorMessage, useListFavorites } from '@repo/api-client';
import type { FavoriteDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { FilePdfIcon, FolderIcon, VaultIcon } from '@phosphor-icons/react';
import { StarIcon } from 'lucide-react';
import { favoriteKey } from '../helpers/favorite-key';
import { useFavorites } from '../hooks/use-favorites';
import { FavoriteLink } from './favorite-link';

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
              key={favoriteKey(favorite.dataroomId, favorite.nodeId)}
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
  const context = favorite.nodeId === null ? 'Data room' : `in ${favorite.dataroomName}`;

  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <FavoriteLink
        favorite={favorite}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FavoriteIcon favorite={favorite} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium group-hover:underline">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{context}</span>
        </span>
      </FavoriteLink>

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
