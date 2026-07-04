import { Link } from '@tanstack/react-router';
import type { DataroomNode, FileNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { FileTextIcon, FolderIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { formatDate, formatFileSize } from '../../../shared/format';

/** One folder/file row: folders navigate, files open the viewer; kebab = actions. */
export function NodeRow({
  dataroomId,
  node,
  onOpenFile,
  onRename,
  onDelete,
}: {
  dataroomId: string;
  node: DataroomNode;
  onOpenFile: (file: FileNode) => void;
  onRename: (node: DataroomNode) => void;
  onDelete: (node: DataroomNode) => void;
}) {
  const meta =
    node.type === 'file'
      ? `${formatFileSize(node.size)} · ${formatDate(node.updatedAt)}`
      : `Updated ${formatDate(node.updatedAt)}`;

  const label = (
    <>
      <span className="block truncate font-medium group-hover:underline">{node.name}</span>
      <span className="block text-xs text-muted-foreground">{meta}</span>
    </>
  );

  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <span
        className={
          node.type === 'folder'
            ? 'flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'
            : 'flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground'
        }
      >
        {node.type === 'folder' ? (
          <FolderIcon className="size-4.5" aria-hidden />
        ) : (
          <FileTextIcon className="size-4.5" aria-hidden />
        )}
      </span>

      {node.type === 'folder' ? (
        <Link
          to="/datarooms/$dataroomId/folders/$folderId"
          params={{ dataroomId, folderId: node.id }}
          className="min-w-0 flex-1 outline-none"
        >
          {label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onOpenFile(node)}
          className="min-w-0 flex-1 cursor-pointer text-left outline-none"
        >
          {label}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${node.name}`}>
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRename(node)}>
            <PencilIcon className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(node)}>
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
