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

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error));

  const add = useAddFavorite({ mutation: { onSuccess: invalidate, onError } });
  const remove = useRemoveFavorite({ mutation: { onSuccess: invalidate, onError } });

  return {
    isFavorite: (dataroomId: string, nodeId: string | null = null) =>
      keys.has(favoriteKey(dataroomId, nodeId)),
    toggle: (dataroomId: string, nodeId: string | null = null) => {
      const data = { dataroomId, nodeId };
      if (keys.has(favoriteKey(dataroomId, nodeId))) remove.mutate({ data });
      else add.mutate({ data });
    },
    isPending: add.isPending || remove.isPending,
  };
}
