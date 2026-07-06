import type { TrashItemDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import { FilePdfIcon, FolderIcon } from '@phosphor-icons/react';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { formatCount, formatDate, formatFileSize } from '@/shared/lib/format';
import { UserAvatar } from '@/shared/components/user-avatar';

interface TrashRowProps {
  item: TrashItemDto;
  disabled: boolean;
  onRestore: () => void;
  onPurge: () => void;
}

/** One trashed item: what it is, who deleted it, restore/purge for editors. */
export function TrashRow({ item, disabled, onRestore, onPurge }: Readonly<TrashRowProps>) {
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
