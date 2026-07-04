import type { DataroomNode } from '@repo/domain';
import { Checkbox } from '@repo/ui/components/checkbox';
import { cn } from '@repo/ui/lib/utils';
import { FilePdfIcon, FolderIcon as FolderFillIcon } from '@phosphor-icons/react';
import { formatDate } from '../../../shared/format';
import { FavoriteButton } from './favorite-button';

interface DocumentGridProps {
  nodes: readonly DataroomNode[];
  selectedIds: ReadonlySet<string>;
  canEdit: boolean;
  selectNodeId?: string | null;
  isFavorite: (nodeId: string) => boolean;
  onToggleFavorite: (nodeId: string) => void;
  onReveal: (node: DataroomNode, element: HTMLElement | null) => void;
  onToggleSelect: (node: DataroomNode, extend: boolean) => void;
  onSelectRow: (node: DataroomNode) => void;
  onOpen: (node: DataroomNode) => void;
}

export function DocumentGrid({
  nodes,
  selectedIds,
  canEdit,
  selectNodeId,
  isFavorite,
  onToggleFavorite,
  onReveal,
  onToggleSelect,
  onSelectRow,
  onOpen,
}: Readonly<DocumentGridProps>) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {nodes.map((node) => {
        const selected = selectedIds.has(node.id);
        return (
          <div
            key={node.id}
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
              'group relative flex aspect-[4/3] cursor-pointer flex-col items-start justify-between rounded-lg border bg-card p-4 text-left select-none hover:bg-accent/40',
              selected ? 'border-primary bg-primary/10' : undefined,
            )}
          >
            <span className="absolute top-1.5 left-1.5" onClick={(event) => event.stopPropagation()}>
              <FavoriteButton
                favorite={isFavorite(node.id)}
                onToggle={() => onToggleFavorite(node.id)}
              />
            </span>
            {canEdit ? (
              <span
                className={cn(
                  'absolute top-2 right-2 transition-opacity',
                  selected
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                )}
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
            ) : null}
            {node.type === 'folder' ? (
              <FolderFillIcon weight="fill" className="size-7 text-primary" />
            ) : (
              <FilePdfIcon weight="fill" className="size-7 text-destructive" />
            )}
            <span className="line-clamp-2 text-sm font-medium">{node.name}</span>
            <span className="text-xs text-muted-foreground">{formatDate(node.updatedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
