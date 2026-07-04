import { useMemo, useState } from 'react';
import { getApiErrorMessage, useListDatarooms } from '@repo/api-client';
import type { Dataroom } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { PlusIcon } from 'lucide-react';
import { SparklesIcon } from 'lucide-react';
import { NameDialog } from '../../../shared/NameDialog';
import {
  useCreateDataroom,
  useCreateSampleDataroom,
  useDeleteDataroom,
  useRenameDataroom,
} from '../hooks';
import { DataroomRow } from './DataroomRow';

export function DataroomsScreen() {
  const datarooms = useListDatarooms();
  const rooms = useMemo(() => datarooms.data?.data ?? [], [datarooms.data]);
  const existingNames = useMemo(() => rooms.map((room) => room.name), [rooms]);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Dataroom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dataroom | null>(null);

  const createDataroom = useCreateDataroom();
  const createSample = useCreateSampleDataroom();
  const renameDataroom = useRenameDataroom();
  const deleteDataroom = useDeleteDataroom();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight uppercase">
            Data rooms
          </h1>
          <p className="text-sm text-muted-foreground">
            Secure spaces for organizing due-diligence documents.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => {
              createDataroom.reset();
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            New data room
          </Button>
        </div>
      </header>

      {datarooms.isPending ? (
        <ul className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-[68px] w-full" />
          <Skeleton className="h-[68px] w-full" />
          <Skeleton className="h-[68px] w-full" />
        </ul>
      ) : datarooms.isError ? (
        <EmptyState
          title="Couldn’t load data rooms"
          description={getApiErrorMessage(datarooms.error)}
          action={
            <Button variant="outline" onClick={() => void datarooms.refetch()}>
              Try again
            </Button>
          }
        />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No data rooms yet"
          description="Create your first data room, or load a sample with a realistic due-diligence structure to explore."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => {
                  createDataroom.reset();
                  setCreateOpen(true);
                }}
              >
                <PlusIcon className="size-4" />
                New data room
              </Button>
              <Button
                variant="outline"
                disabled={createSample.isPending}
                onClick={() => createSample.mutate()}
              >
                <SparklesIcon className="size-4" />
                {createSample.isPending ? 'Creating sample…' : 'Create sample data room'}
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => (
            <DataroomRow
              key={room.id}
              dataroom={room}
              onRename={(target) => {
                renameDataroom.reset();
                setRenameTarget(target);
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </ul>
      )}

      {/* Create */}
      <NameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New data room"
        label="Data room name"
        submitLabel="Create"
        placeholder="e.g. Project Titan — Due Diligence"
        existingNames={existingNames}
        pending={createDataroom.isPending}
        serverError={createDataroom.isError ? getApiErrorMessage(createDataroom.error) : null}
        onSubmit={(name) =>
          createDataroom.mutate({ data: { name } }, { onSuccess: () => setCreateOpen(false) })
        }
      />

      {/* Rename */}
      <NameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Rename data room"
        label="Data room name"
        submitLabel="Rename"
        initialName={renameTarget?.name ?? ''}
        existingNames={existingNames.filter((name) => name !== renameTarget?.name)}
        pending={renameDataroom.isPending}
        serverError={renameDataroom.isError ? getApiErrorMessage(renameDataroom.error) : null}
        onSubmit={(name) => {
          if (!renameTarget) return;
          renameDataroom.mutate(
            { id: renameTarget.id, data: { name } },
            { onSuccess: () => setRenameTarget(null) },
          );
        }}
      />

      {/* Delete */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the data room and everything inside it (all folders and
              files). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteDataroom.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) return;
                deleteDataroom.mutate(
                  { id: deleteTarget.id },
                  { onSuccess: () => setDeleteTarget(null) },
                );
              }}
            >
              {deleteDataroom.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
