import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListActivityQueryKey,
  getListDataroomsQueryKey,
  getListMembersQueryKey,
  useAddMember,
  useRemoveMember,
  useUpdateMember,
} from '@repo/api-client';
import { toast } from '@repo/ui/components/sonner';

/** Member add/update/remove for one data room, with cache refresh + toasts. */
export function useMemberMutations(dataroomId: string) {
  const queryClient = useQueryClient();
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: getListMembersQueryKey(dataroomId) });
    void queryClient.invalidateQueries({ queryKey: getListActivityQueryKey(dataroomId) });
    void queryClient.invalidateQueries({ queryKey: getListDataroomsQueryKey() });
  };
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error));

  const addMember = useAddMember({
    mutation: {
      onSuccess: () => {
        toast.success('Member added');
        invalidate();
      },
      onError,
    },
  });
  const updateMember = useUpdateMember({
    mutation: {
      onSuccess: () => {
        toast.success('Role updated');
        invalidate();
      },
      onError,
    },
  });
  const removeMember = useRemoveMember({
    mutation: {
      onSuccess: () => {
        toast.success('Member removed');
        invalidate();
      },
      onError,
    },
  });

  return { addMember, updateMember, removeMember };
}
