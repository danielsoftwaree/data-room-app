import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListFavoritesQueryKey,
  useAddFavorite,
  useListFavorites,
  useRemoveFavorite,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';
import { favoriteKey } from '../helpers/favorite-key';

/**
 * Star/unstar rooms and nodes from anywhere (table rows, grid, detail panel,
 * dashboard) against a single source of truth. `nodeId === null` targets the
 * room itself; a non-null id targets that folder/file.
 */
export function useFavorites() {
  const queryClient = useQueryClient();
  const favorites = useListFavorites();
  const keys = new Set(
    (favorites.data?.data ?? []).map((favorite) =>
      favoriteKey(favorite.dataroomId, favorite.nodeId),
    ),
  );

  // Returned (not voided) on purpose: the mutation stays pending until the
  // refetch lands, so the optimistic star below never flickers back.
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error));

  const add = useAddFavorite({ mutation: { onSuccess: invalidate, onError } });
  const remove = useRemoveFavorite({ mutation: { onSuccess: invalidate, onError } });

  // Optimistic star: while a toggle is in flight, report its target as already
  // flipped. On error the pending flag clears and the star snaps back — no
  // cache surgery or rollback bookkeeping needed.
  const pendingAddKey =
    add.isPending && add.variables
      ? favoriteKey(add.variables.data.dataroomId, add.variables.data.nodeId ?? null)
      : null;
  const pendingRemoveKey =
    remove.isPending && remove.variables
      ? favoriteKey(remove.variables.data.dataroomId, remove.variables.data.nodeId ?? null)
      : null;
  const isFavorite = (dataroomId: string, nodeId: string | null = null) => {
    const key = favoriteKey(dataroomId, nodeId);
    if (key === pendingAddKey) return true;
    if (key === pendingRemoveKey) return false;
    return keys.has(key);
  };

  return {
    isFavorite,
    toggle: (dataroomId: string, nodeId: string | null = null) => {
      const data = { dataroomId, nodeId };
      if (isFavorite(dataroomId, nodeId)) remove.mutate({ data });
      else add.mutate({ data });
    },
    isPending: add.isPending || remove.isPending,
  };
}
