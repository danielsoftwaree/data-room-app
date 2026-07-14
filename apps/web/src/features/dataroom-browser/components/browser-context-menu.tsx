import type { DataroomNode } from '@repo/domain';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@repo/ui/components/context-menu';
import {
  CheckSquareIcon,
  CopyIcon,
  EyeIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LinkIcon,
  MoveIcon,
  PencilIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';

interface BrowserContextMenuProps {
  /** The right-clicked node, or null when the click hit the empty area. */
  contextNode: DataroomNode | null;
  /** Name shown as the area menu's label (current folder or the room). */
  areaLabel: string;
  canEdit: boolean;
  hasVisibleNodes: boolean;
  isFavorite: (nodeId: string) => boolean;
  onOpenNode: (node: DataroomNode) => void;
  onToggleFavorite: (nodeId: string) => void;
  onCopyLink: () => void;
  /** Open the share dialog for a file (create/manage its public link). */
  onShare: (node: DataroomNode) => void;
  /** Copy an already-shared file's public link without opening the dialog. */
  onCopyShareLink: (node: DataroomNode) => void;
  onRename: (node: DataroomNode) => void;
  onMove: (node: DataroomNode) => void;
  onTrash: (node: DataroomNode) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onSelectAll: () => void;
  onRefresh: () => void;
}

/**
 * The browse area's right-click menu content: node actions when a row was
 * clicked, folder-level actions otherwise. Which one applies is resolved by
 * the screen from the click target (see `handleAreaContextMenu`).
 */
export function BrowserContextMenu({
  contextNode,
  areaLabel,
  canEdit,
  hasVisibleNodes,
  isFavorite,
  onOpenNode,
  onToggleFavorite,
  onCopyLink,
  onShare,
  onCopyShareLink,
  onRename,
  onMove,
  onTrash,
  onCreateFolder,
  onUpload,
  onSelectAll,
  onRefresh,
}: Readonly<BrowserContextMenuProps>) {
  return (
    <ContextMenuContent className="w-52">
      {contextNode ? (
        <>
          <ContextMenuItem onSelect={() => onOpenNode(contextNode)}>
            {contextNode.type === 'folder' ? <FolderOpenIcon /> : <EyeIcon />}
            Open
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onToggleFavorite(contextNode.id)}>
            <StarIcon />
            {isFavorite(contextNode.id) ? 'Remove from favorites' : 'Add to favorites'}
          </ContextMenuItem>
          <ContextMenuItem onSelect={onCopyLink}>
            <LinkIcon />
            Copy link
          </ContextMenuItem>
          {contextNode.shareSlug ? (
            <ContextMenuItem onSelect={() => onCopyShareLink(contextNode)}>
              <CopyIcon />
              Copy share link
            </ContextMenuItem>
          ) : null}
          {canEdit ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onShare(contextNode)}>
                <LinkIcon />
                Share…
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onRename(contextNode)}>
                <PencilIcon />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onMove(contextNode)}>
                <MoveIcon />
                Move
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => onTrash(contextNode)}>
                <Trash2Icon />
                Move to trash
              </ContextMenuItem>
            </>
          ) : null}
        </>
      ) : (
        <>
          <ContextMenuLabel>{areaLabel}</ContextMenuLabel>
          {canEdit ? (
            <>
              <ContextMenuItem onSelect={onCreateFolder}>
                <FolderPlusIcon />
                New folder
              </ContextMenuItem>
              <ContextMenuItem onSelect={onUpload}>
                <UploadIcon />
                Upload PDF
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          ) : null}
          <ContextMenuItem onSelect={onSelectAll} disabled={!hasVisibleNodes}>
            <CheckSquareIcon />
            Select all
          </ContextMenuItem>
          <ContextMenuItem onSelect={onCopyLink}>
            <LinkIcon />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem onSelect={onRefresh}>
            <RefreshCwIcon />
            Refresh
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
