import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getGetNodeShareQueryKey,
  getListActivityQueryKey,
  getListNodesQueryKey,
  useRemoveNodeShare,
  useUpsertNodeShare,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';

/** The share-mutation bundle, as passed from the dialog to its callers. */
export type ShareMutations = ReturnType<typeof useShareMutations>;

/**
 * Create/rotate/remove a file's public share link, wired with cache
 * invalidation. `upsertShare` leaves success toasts to the caller (the same
 * mutation serves both "create link" and "change password", which want
 * different copy); `removeShare` owns its toast since it has one meaning.
 */
export function useShareMutations(dataroomId: string) {
  const queryClient = useQueryClient();
  // A share touches the node's share state, its shareSlug in the listing, and
  // the activity feed — nothing else. Returned (and thus awaited by TanStack
  // before per-call onSuccess) so callers see fresh share state — the dialog's
  // password switch reads `hasPassword` right after saving.
  const invalidate = (nodeId: string): Promise<unknown> =>
    Promise.all(
      [
        getGetNodeShareQueryKey(nodeId),
        getListNodesQueryKey(dataroomId),
        getListActivityQueryKey(dataroomId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  const upsertShare = useUpsertNodeShare({
    mutation: {
      onSuccess: (_response, variables) => invalidate(variables.id),
      // No error toast: the share dialog shows the error inline.
    },
  });

  const removeShare = useRemoveNodeShare({
    mutation: {
      onSuccess: (_response, variables) => {
        toast.success('Share link removed');
        invalidate(variables.id);
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  return { upsertShare, removeShare };
}
