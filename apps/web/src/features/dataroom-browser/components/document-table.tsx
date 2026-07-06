import type { UserDto } from '@repo/api-client';
import type { DataroomNode } from '@repo/domain';
import { Checkbox } from '@repo/ui/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { Button } from '@repo/ui/components/button';
import { Progress } from '@repo/ui/components/progress';
import { cn } from '@repo/ui/lib/utils';
import { FilePdfIcon, FolderIcon as FolderFillIcon } from '@phosphor-icons/react';
import { MoreVerticalIcon, MoveIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import { formatCount, formatDate, formatFileSize } from '@/shared/lib/format';
import { FavoriteButton } from './favorite-button';

interface DocumentTableProps {
  nodes: readonly DataroomNode[];
  uploadingNames: readonly string[];
  selectedIds: ReadonlySet<string>;
  usersById: ReadonlyMap<string, UserDto>;
  memberCount: number;
  canEdit: boolean;
  selectNodeId?: string | null;
  isFavorite: (nodeId: string) => boolean;
  onToggleFavorite: (nodeId: string) => void;
  onReveal: (node: DataroomNode, element: HTMLElement | null) => void;
  onToggleSelect: (node: DataroomNode, extend: boolean) => void;
  onSelectRow: (node: DataroomNode) => void;
  onOpen: (node: DataroomNode) => void;
  onToggleAll: () => void;
  onRename: (node: DataroomNode) => void;
  onMove: (node: DataroomNode) => void;
  onDelete: (node: DataroomNode) => void;
}

const TABLE_GRID = 'grid-cols-[36px_minmax(260px,1.7fr)_160px_100px_160px_120px_84px]';

export function DocumentTable(props: Readonly<DocumentTableProps>) {
  const allSelected =
    props.nodes.length > 0 && props.nodes.every((node) => props.selectedIds.has(node.id));
  const someSelected = props.nodes.some((node) => props.selectedIds.has(node.id));
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="min-w-[920px]">
        <div
          className={cn(
            'grid items-center border-b px-3 py-3 text-xs font-semibold text-muted-foreground',
            TABLE_GRID,
          )}
        >
          {props.canEdit ? (
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={props.onToggleAll}
              aria-label="Select all"
            />
          ) : (
            <span />
          )}
          <span>Name</span>
          <span>Updated</span>
          <span>Size</span>
          <span>Owner</span>
          <span>Access</span>
          <span />
        </div>
        {props.nodes.map((node) => (
          <DocumentRow key={node.id} node={node} {...props} />
        ))}
        {props.uploadingNames.map((name) => (
          <div
            key={name}
            className="grid grid-cols-[36px_minmax(260px,1.7fr)_1fr_40px] items-center border-t px-3 py-3"
          >
            <Checkbox disabled aria-label={`Uploading ${name}`} />
            <div className="flex items-center gap-3">
              <FilePdfIcon weight="fill" className="size-5 text-destructive" />
              <span className="truncate text-sm font-medium">{name}</span>
            </div>
            <Progress value={null} />
            <XIcon className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentRow({
  node,
  selectedIds,
  usersById,
  memberCount,
  canEdit,
  selectNodeId,
  isFavorite,
  onToggleFavorite,
  onReveal,
  onToggleSelect,
  onSelectRow,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: Readonly<DocumentTableProps & { node: DataroomNode }>) {
  const selected = selectedIds.has(node.id);
  const owner = node.createdBy ? usersById.get(node.createdBy) : undefined;
  return (
    <div
      ref={node.id === selectNodeId ? (element) => onReveal(node, element) : undefined}
      role="button"
      tabIndex={0}
      data-node-id={node.id}
      onClick={() => onSelectRow(node)}
      onDoubleClick={() => onOpen(node)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpen(node);
        }
      }}
      className={cn(
        'group grid cursor-pointer items-center border-t px-3 py-2.5 text-sm select-none hover:bg-accent/40',
        TABLE_GRID,
        selected ? 'bg-primary/10' : undefined,
      )}
    >
      {canEdit ? (
        <span
          className="flex h-full w-full items-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            aria-label={`Select ${node.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect(node, event.shiftKey);
            }}
          />
        </span>
      ) : (
        <span />
      )}
      <div className="flex min-w-0 items-center gap-3">
        {node.type === 'folder' ? (
          <FolderFillIcon weight="fill" className="size-5 text-primary" />
        ) : (
          <FilePdfIcon weight="fill" className="size-5 text-destructive" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>
      <span className="text-muted-foreground">{formatDate(node.updatedAt)}</span>
      <span className="text-muted-foreground">
        {node.type === 'file' ? formatFileSize(node.size) : '\u2014'}
      </span>
      <span className="truncate">{owner?.name ?? '\u2014'}</span>
      <span className="text-muted-foreground">{formatCount(memberCount, 'member')}</span>
      <span className="flex items-center justify-end gap-0.5">
        <FavoriteButton favorite={isFavorite(node.id)} onToggle={() => onToggleFavorite(node.id)} />
        {canEdit ? (
          <RowActions node={node} onRename={onRename} onMove={onMove} onDelete={onDelete} />
        ) : null}
      </span>
    </div>
  );
}

function RowActions({
  node,
  onRename,
  onMove,
  onDelete,
}: Readonly<{
  node: DataroomNode;
  onRename: (node: DataroomNode) => void;
  onMove: (node: DataroomNode) => void;
  onDelete: (node: DataroomNode) => void;
}>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={(event) => event.stopPropagation()}>
          <MoreVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRename(node)}>
          <PencilIcon className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMove(node)}>
          <MoveIcon className="size-4" />
          Move
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(node)}>
          <Trash2Icon className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
