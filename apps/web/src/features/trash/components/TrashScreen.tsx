import { useState } from 'react';
import { getApiErrorMessage, useListTrash } from '@repo/api-client';
import type { TrashItemDto } from '@repo/api-client';
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
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { FilePdfIcon, FolderIcon } from '@phosphor-icons/react';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { formatCount, formatDate, formatFileSize } from '../../../shared/format';
import { UserAvatar } from '../../../shared/UserAvatar';
import { useTrashMutations } from '../hooks';

export function TrashScreen() {
  const trash = useListTrash();
  const items = trash.data?.data ?? [];
  const { restore, purge, empty } = useTrashMutations();
  const [purgeTarget, setPurgeTarget] = useState<TrashItemDto | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);

  const canEmpty = items.some((item) => item.myRole !== 'viewer');
  const busy = restore.isPending || purge.isPending || empty.isPending;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight uppercase">Trash</h1>
          <p className="text-sm text-muted-foreground">
            Restore items to their data room, or delete them for good. Storage frees up only after
            permanent deletion.
          </p>
        </div>
        {items.length > 0 && canEmpty ? (
          <Button
            variant="outline"
            className="shrink-0 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setEmptyOpen(true)}
          >
            <Trash2Icon className="size-4" />
            Empty trash
          </Button>
        ) : null}
      </header>

      {trash.isPending ? (
        <ul className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-[68px] w-full" />
          <Skeleton className="h-[68px] w-full" />
          <Skeleton className="h-[68px] w-full" />
        </ul>
      ) : trash.isError ? (
        <EmptyState
          title="Couldn’t load the trash"
          description={getApiErrorMessage(trash.error)}
          action={
            <Button variant="outline" onClick={() => void trash.refetch()}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Trash is empty"
          description="Items you delete from a data room land here, where you can restore or permanently remove them."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <TrashRow
              key={item.id}
              item={item}
              disabled={busy}
              onRestore={() => restore.mutate({ id: item.id })}
              onPurge={() => setPurgeTarget(item)}
            />
          ))}
        </ul>
      )}

      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every item you have access to remove. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={empty.isPending}
              onClick={(event) => {
                event.preventDefault();
                empty.mutate(undefined, { onSuccess: () => setEmptyOpen(false) });
              }}
            >
              {empty.isPending ? 'Emptying…' : 'Empty trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPurgeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{purgeTarget?.name}” forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the item{purgeTarget && purgeTarget.itemCount > 0
                ? ` and its ${formatCount(purgeTarget.itemCount, 'item')}`
                : ''}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={purge.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!purgeTarget) return;
                purge.mutate({ id: purgeTarget.id }, { onSuccess: () => setPurgeTarget(null) });
              }}
            >
              {purge.isPending ? 'Deleting…' : 'Delete forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function TrashRow({
  item,
  disabled,
  onRestore,
  onPurge,
}: Readonly<{
  item: TrashItemDto;
  disabled: boolean;
  onRestore: () => void;
  onPurge: () => void;
}>) {
  const canEdit = item.myRole === 'owner' || item.myRole === 'editor';
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {item.type === 'folder' ? (
          <FolderIcon weight="fill" className="size-4.5 text-primary" />
        ) : (
          <FilePdfIcon weight="fill" className="size-4.5 text-destructive" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          in {item.dataroomName} ·{' '}
          {item.type === 'file'
            ? formatFileSize(item.size ?? 0)
            : formatCount(item.itemCount, 'item')}
        </p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <UserAvatar user={item.deletedBy ?? undefined} className="size-7 text-[10px]" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{item.deletedBy?.name ?? 'Someone'}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(item.deletedAt)}</p>
        </div>
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" disabled={disabled} onClick={onRestore}>
            <RotateCcwIcon className="size-4" />
            Restore
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${item.name} forever`}
            className="text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={onPurge}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">View only</span>
      )}
    </li>
  );
}
