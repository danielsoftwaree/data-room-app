import type { DataroomDto } from '@repo/api-client';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useDeleteDataroom } from '../hooks/use-dataroom-mutations.mutation';

interface DeleteDataroomDialogProps {
  /** The room being deleted; null keeps the dialog closed. */
  dataroom: DataroomDto | null;
  onClose: () => void;
}

/** Confirmation for the irreversible data-room delete (owner only). */
export function DeleteDataroomDialog({ dataroom, onClose }: Readonly<DeleteDataroomDialogProps>) {
  const deleteDataroom = useDeleteDataroom();

  return (
    <ConfirmDialog
      open={dataroom !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Delete “${dataroom?.name}”?`}
      description="This permanently deletes the data room and everything inside it (all folders and files). This action cannot be undone."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      pending={deleteDataroom.isPending}
      onConfirm={() => {
        if (!dataroom) return;
        deleteDataroom.mutate({ id: dataroom.id }, { onSuccess: onClose });
      }}
    />
  );
}
