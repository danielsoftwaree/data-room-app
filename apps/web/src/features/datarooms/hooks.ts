import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getGetDataroomQueryKey,
  getListDataroomsQueryKey,
  getListNodesQueryKey,
  useCreateDataroom as useCreateDataroomBase,
  useDeleteDataroom as useDeleteDataroomBase,
  useRenameDataroom as useRenameDataroomBase,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';

/** Invalidate everything that depends on the set/þords of data rooms. */
function useInvalidateDatarooms() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: getListDataroomsQueryKey() });
}

export function useCreateDataroom() {
  const invalidate = useInvalidateDatarooms();
  return useCreateDataroomBase({
    mutation: {
      onSuccess: (response) => {
        toast.success(`Data room "${response.data.name}" created`);
        void invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });
}

export function useRenameDataroom() {
  const invalidate = useInvalidateDatarooms();
  const queryClient = useQueryClient();
  return useRenameDataroomBase({
    mutation: {
      onSuccess: (response) => {
        toast.success('Data room renamed');
        void invalidate();
        void queryClient.invalidateQueries({
          queryKey: getGetDataroomQueryKey(response.data.id),
        });
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });
}

export function useDeleteDataroom() {
  const invalidate = useInvalidateDatarooms();
  const queryClient = useQueryClient();
  return useDeleteDataroomBase({
    mutation: {
      onSuccess: (response, variables) => {
        toast.success('Data room deleted');
        void invalidate();
        void queryClient.removeQueries({ queryKey: getListNodesQueryKey(variables.id) });
        void queryClient.removeQueries({ queryKey: getGetDataroomQueryKey(variables.id) });
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });
}
