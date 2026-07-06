import { useState } from 'react';
import { getApiErrorMessage, useListDatarooms } from '@repo/api-client';
import type { DataroomDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { PlusIcon, SparklesIcon } from 'lucide-react';
import { useFavorites } from '@/features/favorites';
import { useCreateSampleDataroom } from '../hooks/use-dataroom-mutations.mutation';
import { CreateDataroomDialog } from './create-dataroom-dialog';
import { DataroomRow } from './dataroom-row';
import { DataroomStats } from './dataroom-stats';
import { DataroomsSidePanel } from './datarooms-side-panel';
import { DeleteDataroomDialog } from './delete-dataroom-dialog';
import { RenameDataroomDialog } from './rename-dataroom-dialog';

export function DataroomsScreen() {
  const datarooms = useListDatarooms();
  const rooms = datarooms.data?.data ?? [];
  const favorites = useFavorites();
  const createSample = useCreateSampleDataroom();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DataroomDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataroomDto | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
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
          <Button onClick={() => setCreateOpen(true)}>
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
              <Button onClick={() => setCreateOpen(true)}>
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
        <>
          <DataroomStats roomCount={rooms.length} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <ul className="flex h-fit flex-col gap-2">
              {rooms.map((room) => (
                <DataroomRow
                  key={room.id}
                  dataroom={room}
                  isFavorite={favorites.isFavorite(room.id)}
                  onToggleFavorite={() => favorites.toggle(room.id)}
                  onRename={setRenameTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </ul>

            <DataroomsSidePanel onCreate={() => setCreateOpen(true)} />
          </div>
        </>
      )}

      <CreateDataroomDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RenameDataroomDialog dataroom={renameTarget} onClose={() => setRenameTarget(null)} />
      <DeleteDataroomDialog dataroom={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </main>
  );
}
