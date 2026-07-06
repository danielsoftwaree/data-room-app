import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListDataroomsQueryKey,
  getListNodesQueryKey,
  useCreateFile as useCreateFileBase,
  useCreateFolder as useCreateFolderBase,
  useDeleteNode as useDeleteNodeBase,
  useMoveNode as useMoveNodeBase,
  useRenameNode as useRenameNodeBase,
  useRestoreNode as useRestoreNodeBase,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';

/** The node-mutation bundle, as passed from the screen to browser components. */
export type NodeMutations = ReturnType<typeof useNodeMutations>;

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
    void queryClient.invalidateQueries();
  };

  const createFolder = useCreateFolderBase({
    mutation: {
      onSuccess: () => {
        toast.success('Folder created');
        invalidate();
      },
      // No error toast: create runs from NameDialog, which shows the error inline.
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
      // No error toast: rename runs from NameDialog, which shows the error inline.
    },
  });

  const restoreNode = useRestoreNodeBase({
    mutation: {
      onSuccess: () => {
        toast.success('Restored');
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  const deleteNode = useDeleteNodeBase({
    mutation: {
      // Trash is reversible, so the toast offers a one-click Undo (restore).
      onSuccess: (_response, variables) => {
        toast.success('Moved to trash', {
          action: { label: 'Undo', onClick: () => restoreNode.mutate({ id: variables.id }) },
        });
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  const moveNode = useMoveNodeBase({
    mutation: {
      onSuccess: () => {
        toast.success('Moved');
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });

  return { createFolder, createFile, renameNode, deleteNode, moveNode, restoreNode };
}
