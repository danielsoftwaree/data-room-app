import { useState } from 'react';
import { getApiErrorMessage, useListTrash } from '@repo/api-client';
import type { TrashItemDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { Trash2Icon } from 'lucide-react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { formatCount } from '@/shared/lib/format';
import { useTrashMutations } from '../hooks/use-trash-mutations.mutation';
import { TrashRow } from './trash-row';

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

      <ConfirmDialog
        open={emptyOpen}
        onOpenChange={setEmptyOpen}
        title="Empty trash?"
        description="This permanently deletes every item you have access to remove. This cannot be undone."
        confirmLabel="Empty trash"
        pendingLabel="Emptying…"
        pending={empty.isPending}
        onConfirm={() => empty.mutate(undefined, { onSuccess: () => setEmptyOpen(false) })}
      />

      <ConfirmDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPurgeTarget(null);
        }}
        title={`Delete “${purgeTarget?.name}” forever?`}
        description={`This permanently removes the item${
          purgeTarget && purgeTarget.itemCount > 0
            ? ` and its ${formatCount(purgeTarget.itemCount, 'item')}`
            : ''
        }. This cannot be undone.`}
        confirmLabel="Delete forever"
        pendingLabel="Deleting…"
        pending={purge.isPending}
        onConfirm={() => {
          if (!purgeTarget) return;
          purge.mutate({ id: purgeTarget.id }, { onSuccess: () => setPurgeTarget(null) });
        }}
      />
    </main>
  );
}
