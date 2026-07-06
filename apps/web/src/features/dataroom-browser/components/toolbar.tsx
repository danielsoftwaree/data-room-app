import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import {
  CheckIcon,
  FilterIcon,
  FolderPlusIcon,
  Grid2X2Icon,
  ListIcon,
  UploadIcon,
} from 'lucide-react';
import type { FilterMode, SortDir, SortKey, ViewMode } from '../types';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  updated: 'Updated',
  size: 'Size',
};

interface ToolbarProps {
  filter: FilterMode;
  sortKey: SortKey;
  sortDir: SortDir;
  view: ViewMode;
  canEdit: boolean;
  uploading: boolean;
  onFilter: (filter: FilterMode) => void;
  onSortKey: (sortKey: SortKey) => void;
  onSortDir: () => void;
  onView: (view: ViewMode) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
}

export function Toolbar(props: Readonly<ToolbarProps>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Upload / New Folder are for editors and owners; viewers see a read-only browser. */}
      <div className="flex items-center gap-2">
        {props.canEdit ? (
          <>
            <Button onClick={props.onUpload} disabled={props.uploading}>
              <UploadIcon className="size-4" />
              {props.uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button variant="outline" onClick={props.onCreateFolder}>
              <FolderPlusIcon className="size-4" />
              New Folder
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                props.filter !== 'all' &&
                  'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              )}
            >
              <FilterIcon className="size-4" />
              {props.filter === 'all' ? 'All' : props.filter === 'folders' ? 'Folders' : 'Files'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['all', 'folders', 'files'] as const).map((mode) => (
              <DropdownMenuItem key={mode} onSelect={() => props.onFilter(mode)}>
                {props.filter === mode ? <CheckIcon className="size-4" /> : null}
                {mode[0].toUpperCase() + mode.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Sort: {SORT_LABELS[props.sortKey]}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['name', 'updated', 'size'] as const).map((key) => (
              <DropdownMenuItem key={key} onSelect={() => props.onSortKey(key)}>
                {props.sortKey === key ? <CheckIcon className="size-4" /> : null}
                {SORT_LABELS[key]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={props.onSortDir}>
              Direction: {props.sortDir === 'asc' ? 'Ascending' : 'Descending'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex overflow-hidden rounded-md border">
          <Button
            variant={props.view === 'list' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="List view"
            onClick={() => props.onView('list')}
          >
            <ListIcon className="size-4" />
          </Button>
          <Button
            variant={props.view === 'grid' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="Grid view"
            onClick={() => props.onView('grid')}
          >
            <Grid2X2Icon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
