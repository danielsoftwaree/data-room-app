import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListDataroomsQueryKey,
  getListNodesQueryKey,
  useCreateFile as useCreateFileBase,
  useCreateFolder as useCreateFolderBase,
  useDeleteNode as useDeleteNodeBase,
  useRenameNode as useRenameNodeBase,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';

/**
 * Node mutations for one data room, wired with cache invalidation + toasts.
 * `createFile` deliberately leaves error handling to the caller so multi-file
 * uploads can report per-file partial failures.
 */
export function useNodeMutations(dataroomId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListNodesQueryKey(dataroomId) });
    void queryClient.invalidateQueries({ queryKey: getListDataroomsQueryKey() });
  };

  const createFolder = useCreateFolderBase({
    mutation: {
      onSuccess: () => {
        toast.success('Folder created');
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  const createFile = useCreateFileBase({
    mutation: { onSuccess: () => invalidate() },
  });

  const renameNode = useRenameNodeBase({
    mutation: {
      onSuccess: () => {
        toast.success('Renamed');
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  const deleteNode = useDeleteNodeBase({
    mutation: {
      onSuccess: (response) => {
        toast.success(
          response.data.deletedIds.length > 1 ? 'Deleted folder and its contents' : 'Deleted',
        );
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  return { createFolder, createFile, renameNode, deleteNode };
}
