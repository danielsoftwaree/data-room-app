import { Link } from '@tanstack/react-router';
import type { DataroomDto } from '@repo/api-client';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import { VaultIcon } from '@phosphor-icons/react';
import { MoreVerticalIcon, PencilIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { formatCount, formatDate } from '@/shared/lib/format';
import { UserAvatar } from '@/shared/components/user-avatar';

/** A single data room row: click to open, with owner, access, favorite, and owner-only actions. */
export function DataroomRow({
  dataroom,
  isFavorite,
  onToggleFavorite,
  onRename,
  onDelete,
}: {
  dataroom: DataroomDto;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onRename: (dataroom: DataroomDto) => void;
  onDelete: (dataroom: DataroomDto) => void;
}) {
  const isOwner = dataroom.myRole === 'owner';
  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <VaultIcon weight="fill" className="size-4.5" aria-hidden />
      </span>

      <Link
        to="/datarooms/$dataroomId"
        params={{ dataroomId: dataroom.id }}
        className="min-w-0 flex-1 outline-none"
      >
        <span className="block truncate font-medium group-hover:underline">{dataroom.name}</span>
        <span className="block text-xs text-muted-foreground">
          Updated {formatDate(dataroom.updatedAt)} · {formatCount(dataroom.memberCount, 'member')}
        </span>
      </Link>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <UserAvatar user={dataroom.owner ?? undefined} className="size-7 text-[10px]" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{dataroom.owner?.name ?? 'Unassigned'}</p>
          <p className="text-[11px] text-muted-foreground">Owner</p>
        </div>
      </div>

      <Badge variant="secondary" className="hidden capitalize sm:inline-flex">
        {dataroom.myRole}
      </Badge>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFavorite}
        onClick={onToggleFavorite}
      >
        <StarIcon
          className={cn(
            'size-4',
            isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground',
          )}
        />
      </Button>

      {isOwner ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${dataroom.name}`}>
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
      ) : (
        <span className="size-9" aria-hidden />
      )}
    </li>
  );
}
