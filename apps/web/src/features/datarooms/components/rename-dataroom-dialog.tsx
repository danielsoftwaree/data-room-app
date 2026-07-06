import { getApiErrorMessage, useListDatarooms } from '@repo/api-client';
import type { DataroomDto } from '@repo/api-client';
import { NameDialog } from '@/shared/components/name-dialog';
import { useRenameDataroom } from '../hooks/use-dataroom-mutations.mutation';

interface RenameDataroomDialogProps {
  /** The room being renamed; null keeps the dialog closed. */
  dataroom: DataroomDto | null;
  onClose: () => void;
}

/** Self-contained "Rename data room" dialog: owns the mutation and name checks. */
export function RenameDataroomDialog({ dataroom, onClose }: Readonly<RenameDataroomDialogProps>) {
  const datarooms = useListDatarooms();
  const renameDataroom = useRenameDataroom();
  const existingNames = (datarooms.data?.data ?? [])
    .map((room) => room.name)
    .filter((name) => name !== dataroom?.name);

  return (
    <NameDialog
      open={dataroom !== null}
      onOpenChange={(open) => {
        if (open) return;
        // Closing clears any stale server error before the next open.
        renameDataroom.reset();
        onClose();
      }}
      title="Rename data room"
      label="Data room name"
      submitLabel="Rename"
      initialName={dataroom?.name ?? ''}
      existingNames={existingNames}
      pending={renameDataroom.isPending}
      serverError={renameDataroom.isError ? getApiErrorMessage(renameDataroom.error) : null}
      onSubmit={(name) => {
        if (!dataroom) return;
        renameDataroom.mutate({ id: dataroom.id, data: { name } }, { onSuccess: onClose });
      }}
    />
  );
}
