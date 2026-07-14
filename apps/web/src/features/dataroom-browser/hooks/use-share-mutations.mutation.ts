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
  // the activity feed — nothing else.
  const invalidate = (nodeId: string): void => {
    for (const queryKey of [
      getGetNodeShareQueryKey(nodeId),
      getListNodesQueryKey(dataroomId),
      getListActivityQueryKey(dataroomId),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

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
