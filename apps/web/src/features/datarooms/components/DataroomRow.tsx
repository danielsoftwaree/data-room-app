import { Link } from '@tanstack/react-router';
import type { Dataroom } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { FolderIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { formatDate } from '../../../shared/format';

/** A single data room row in the list: click to open, kebab menu for actions. */
export function DataroomRow({
  dataroom,
  onRename,
  onDelete,
}: {
  dataroom: Dataroom;
  onRename: (dataroom: Dataroom) => void;
  onDelete: (dataroom: Dataroom) => void;
}) {
  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FolderIcon className="size-4.5" aria-hidden />
      </span>

      <Link
        to="/datarooms/$dataroomId"
        params={{ dataroomId: dataroom.id }}
        className="min-w-0 flex-1 outline-none"
      >
        <span className="block truncate font-medium group-hover:underline">{dataroom.name}</span>
        <span className="block text-xs text-muted-foreground">
          Updated {formatDate(dataroom.updatedAt)}
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${dataroom.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRename(dataroom)}>
            <PencilIcon className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(dataroom)}>
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
