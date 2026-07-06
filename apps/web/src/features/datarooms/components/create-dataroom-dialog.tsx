import { getApiErrorMessage, useListDatarooms } from '@repo/api-client';
import type { DataroomDto } from '@repo/api-client';
import { NameDialog } from '@/shared/components/name-dialog';
import { useCreateDataroom } from '../hooks/use-dataroom-mutations.mutation';

interface CreateDataroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after a successful create (dialog already closed), e.g. to navigate. */
  onCreated?: (dataroom: DataroomDto) => void;
}

/**
 * Self-contained "New data room" dialog: owns the create mutation and the
 * duplicate-name list, so the dashboard and the sidebar share one implementation.
 */
export function CreateDataroomDialog({
  open,
  onOpenChange,
  onCreated,
}: Readonly<CreateDataroomDialogProps>) {
  const datarooms = useListDatarooms();
  const createDataroom = useCreateDataroom();
  const existingNames = (datarooms.data?.data ?? []).map((room) => room.name);

  return (
    <NameDialog
      open={open}
      onOpenChange={(next) => {
        // Closing clears any stale server error before the next open.
        if (!next) createDataroom.reset();
        onOpenChange(next);
      }}
      title="New data room"
      label="Data room name"
      submitLabel="Create"
      placeholder="e.g. Project Titan — Due Diligence"
      existingNames={existingNames}
      pending={createDataroom.isPending}
      serverError={createDataroom.isError ? getApiErrorMessage(createDataroom.error) : null}
      onSubmit={(name) =>
        createDataroom.mutate(
          { data: { name } },
          {
            onSuccess: (response) => {
              onOpenChange(false);
              onCreated?.(response.data);
            },
          },
        )
      }
    />
  );
}
