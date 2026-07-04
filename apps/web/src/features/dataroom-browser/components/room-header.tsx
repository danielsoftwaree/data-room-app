import type { ActivityDto } from '@repo/api-client';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { Input } from '@repo/ui/components/input';
import { cn } from '@repo/ui/lib/utils';
import { FolderIcon as FolderFillIcon, VaultIcon } from '@phosphor-icons/react';
import { BellIcon, SearchIcon, StarIcon, UsersIcon } from 'lucide-react';
import { UserMenu } from '../../../shared/UserMenu';
import { formatCount } from '../../../shared/format';
import { activityLabel } from '../helpers/activity-label';

interface RoomHeaderProps {
  name: string;
  kind: 'room' | 'folder';
  memberCount: number;
  isFavorite: boolean;
  searchTerm: string;
  activity: readonly ActivityDto[];
  onToggleFavorite: () => void;
  onOpenMembers: () => void;
  onSearch: (term: string) => void;
}

export function RoomHeader({
  name,
  kind,
  memberCount,
  isFavorite,
  searchTerm,
  activity,
  onToggleFavorite,
  onOpenMembers,
  onSearch,
}: Readonly<RoomHeaderProps>) {
  return (
    <header className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-4 border-b bg-card px-4 py-3 sm:px-6">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        {kind === 'folder' ? (
          <FolderFillIcon weight="fill" className="size-5" />
        ) : (
          <VaultIcon weight="fill" className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-lg font-extrabold tracking-tight">{name}</h1>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Toggle favorite"
            onClick={onToggleFavorite}
          >
            <StarIcon
              className={cn(
                'size-4',
                isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground',
              )}
            />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Data Room</Badge>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onOpenMembers}
          >
            <UsersIcon className="mr-1 inline size-3.5" />
            {formatCount(memberCount, 'member')}
          </button>
        </div>
      </div>

      <div className="relative hidden w-[min(32vw,420px)] md:block">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchTerm}
          placeholder="Search this data room"
          className="h-10 pl-9"
          onChange={(event) => onSearch(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onSearch('');
          }}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Recent activity">
            <BellIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Recent activity</DropdownMenuLabel>
          {activity.length === 0 ? (
            <DropdownMenuItem disabled>No activity yet</DropdownMenuItem>
          ) : (
            activity.slice(0, 6).map((entry) => (
              <DropdownMenuItem key={entry.id} className="flex-col items-start gap-0">
                <span>{activityLabel(entry)}</span>
                <span className="text-xs text-muted-foreground">{entry.actor.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserMenu compact />
    </header>
  );
}
