import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  useEmptyTrash,
  usePurgeNode,
  useRestoreNode,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';

/**
 * Trash actions wired with toasts + a blanket cache refresh (trash, nodes,
 * favorites, storage, and dashboard counts all move together).
 */
export function useTrashMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries();
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error));

  const restore = useRestoreNode({
    mutation: {
      onSuccess: () => {
        toast.success('Restored');
        invalidate();
      },
      onError,
    },
  });
  const purge = usePurgeNode({
    mutation: {
      onSuccess: () => {
        toast.success('Permanently deleted');
        invalidate();
      },
      onError,
    },
  });
  const empty = useEmptyTrash({
    mutation: {
      onSuccess: () => {
        toast.success('Trash emptied');
        invalidate();
      },
      onError,
    },
  });

  return { restore, purge, empty };
}
