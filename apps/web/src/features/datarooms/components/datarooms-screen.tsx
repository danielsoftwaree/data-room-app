import { useMemo, useState } from 'react';
import {
  getApiErrorMessage,
  useGetStorageUsage,
  useListDatarooms,
  useListFavorites,
} from '@repo/api-client';
import type { DataroomDto } from '@repo/api-client';
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
import { Progress } from '@repo/ui/components/progress';
import { Skeleton } from '@repo/ui/components/skeleton';
import {
  HardDriveIcon,
  LayoutGridIcon,
  MousePointerClickIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
} from 'lucide-react';
import { NameDialog } from '../../../shared/NameDialog';
import { useFavorites } from '../../../shared/favorites';
import { formatFileSize } from '../../../shared/format';
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
  const [renameTarget, setRenameTarget] = useState<DataroomDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataroomDto | null>(null);

  const createDataroom = useCreateDataroom();
  const createSample = useCreateSampleDataroom();
  const renameDataroom = useRenameDataroom();
  const deleteDataroom = useDeleteDataroom();

  const storage = useGetStorageUsage();
  const favorites = useListFavorites();
  const favoriteControls = useFavorites();
  const storageUsage = storage.data?.data;
  const storagePercent = storageUsage
    ? Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.quotaBytes) * 100))
    : 0;
  const favoriteCount = favorites.data?.data.length ?? 0;

  function openCreate(): void {
    createDataroom.reset();
    setCreateOpen(true);
  }

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
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              icon={LayoutGridIcon}
              value={rooms.length}
              label={rooms.length === 1 ? 'Data room' : 'Data rooms'}
            />
            <StatTile
              icon={HardDriveIcon}
              value={storageUsage ? formatFileSize(storageUsage.usedBytes) : '—'}
              label={
                storageUsage ? `of ${formatFileSize(storageUsage.quotaBytes)} used` : 'Storage'
              }
            />
            <StatTile
              icon={StarIcon}
              value={favoriteCount}
              label={favoriteCount === 1 ? 'Favorite' : 'Favorites'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <ul className="flex h-fit flex-col gap-2">
              {rooms.map((room) => (
                <DataroomRow
                  key={room.id}
                  dataroom={room}
                  isFavorite={favoriteControls.isFavorite(room.id)}
                  onToggleFavorite={() => favoriteControls.toggle(room.id)}
                  onRename={(target) => {
                    renameDataroom.reset();
                    setRenameTarget(target);
                  }}
                  onDelete={setDeleteTarget}
                />
              ))}
            </ul>

            <aside className="flex flex-col gap-4">
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">Get started</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Spin up a new space or explore a realistic sample.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button onClick={openCreate}>
                    <PlusIcon className="size-4" />
                    New data room
                  </Button>
                  <Button
                    variant="outline"
                    disabled={createSample.isPending}
                    onClick={() => createSample.mutate()}
                  >
                    <SparklesIcon className="size-4" />
                    {createSample.isPending ? 'Creating sample…' : 'Create sample'}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <HardDriveIcon className="size-4 text-muted-foreground" />
                  Storage
                </div>
                {storageUsage ? (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {formatFileSize(storageUsage.usedBytes)} of{' '}
                    {formatFileSize(storageUsage.quotaBytes)} used
                  </p>
                ) : (
                  <Skeleton className="mb-2 h-4 w-28" />
                )}
                <Progress value={storagePercent} />
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <MousePointerClickIcon className="size-4 text-muted-foreground" />
                  Tips
                </div>
                <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-primary">•</span> Right-click any file or folder for quick
                    actions.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span> Tick the checkbox to select several
                    items at once.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span> Star a room to pin it to your sidebar.
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </>
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
              variant="destructive"
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

function StatTile({
  icon: Icon,
  value,
  label,
}: Readonly<{ icon: typeof LayoutGridIcon; value: string | number; label: string }>) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
