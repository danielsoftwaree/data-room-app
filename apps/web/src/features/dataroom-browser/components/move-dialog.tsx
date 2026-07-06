import type { DataroomNode, FolderNode } from '@repo/domain';
import { collectSubtreeIds } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { FolderIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { childrenOf } from '@/shared/lib/node-tree';
import { cn } from '@repo/ui/lib/utils';

interface MoveDialogProps {
  open: boolean;
  nodes: readonly DataroomNode[];
  targets: readonly DataroomNode[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (parentId: string | null) => void;
}

export function MoveDialog({
  open,
  nodes,
  targets,
  pending,
  onOpenChange,
  onMove,
}: Readonly<MoveDialogProps>) {
  const [parentId, setParentId] = useState<string | null>(null);
  const folders = nodes.filter((node): node is FolderNode => node.type === 'folder');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {targets.length === 1 ? targets[0]?.name : `${targets.length} items`}
          </DialogTitle>
          <DialogDescription>
            Select a folder in this data room. Invalid destinations are disabled.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[360px] overflow-auto rounded-lg border p-2">
          <MoveOption
            label="Data room root"
            depth={0}
            selected={parentId === null}
            disabled={isDisabled(null, nodes, targets)}
            onSelect={() => setParentId(null)}
          />
          {folders
            .filter((folder) => folder.parentId === null)
            .map((folder) => (
              <FolderOption
                key={folder.id}
                folder={folder}
                depth={0}
                nodes={nodes}
                targets={targets}
                selectedParentId={parentId}
                onSelect={setParentId}
              />
            ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || isDisabled(parentId, nodes, targets)}
            onClick={() => onMove(parentId)}
          >
            {pending ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FolderOptionProps {
  folder: FolderNode;
  depth: number;
  nodes: readonly DataroomNode[];
  targets: readonly DataroomNode[];
  selectedParentId: string | null;
  onSelect: (parentId: string) => void;
}

function FolderOption({
  folder,
  depth,
  nodes,
  targets,
  selectedParentId,
  onSelect,
}: Readonly<FolderOptionProps>) {
  const disabled = isDisabled(folder.id, nodes, targets);
  return (
    <>
      <MoveOption
        label={folder.name}
        depth={depth + 1}
        selected={selectedParentId === folder.id}
        disabled={disabled}
        onSelect={() => onSelect(folder.id)}
      />
      {childrenOf(nodes, folder.id)
        .filter((node): node is FolderNode => node.type === 'folder')
        .map((child) => (
          <FolderOption
            key={child.id}
            folder={child}
            depth={depth + 1}
            nodes={nodes}
            targets={targets}
            selectedParentId={selectedParentId}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function MoveOption({
  label,
  depth,
  selected,
  disabled,
  onSelect,
}: Readonly<{
  label: string;
  depth: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
        selected ? 'bg-accent text-accent-foreground' : undefined,
      )}
      data-selected={selected}
    >
      <span className={cn('shrink-0', depthWidthClass(depth))} />
      <FolderIcon weight="fill" className="size-4 text-primary" />
      <span className="truncate font-medium">{label}</span>
      {selected ? <span className="ml-auto text-xs text-primary">Selected</span> : null}
    </button>
  );
}

function depthWidthClass(depth: number): string {
  return ['w-0', 'w-4', 'w-8', 'w-12', 'w-16', 'w-20'][Math.min(depth, 5)];
}

function isDisabled(
  parentId: string | null,
  nodes: readonly DataroomNode[],
  targets: readonly DataroomNode[],
): boolean {
  if (targets.length === 0) return true;
  if (parentId === null) return targets.every((target) => target.parentId === null);
  return targets.some((target) => {
    if (target.parentId === parentId) return true;
    if (target.id === parentId) return true;
    if (target.type !== 'folder') return false;
    return collectSubtreeIds(nodes, target.id).includes(parentId);
  });
}
