import { Link } from '@tanstack/react-router';
import type { DataroomNode, FileNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { FileTextIcon, FolderIcon } from 'lucide-react';
import { formatDate, formatFileSize } from '../../../shared/format';
import { folderPath } from '../../../shared/node-tree';

interface SearchResultsProps {
  dataroomId: string;
  dataroomName: string;
  query: string;
  results: readonly DataroomNode[];
  allNodes: readonly DataroomNode[];
  isLoading: boolean;
  onOpenFile: (file: FileNode) => void;
  onClearSearch: () => void;
}

export function SearchResults({
  dataroomId,
  dataroomName,
  query,
  results,
  allNodes,
  isLoading,
  onOpenFile,
  onClearSearch,
}: Readonly<SearchResultsProps>) {
  if (isLoading) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        <Skeleton className="h-[76px] w-full" />
        <Skeleton className="h-[76px] w-full" />
        <Skeleton className="h-[76px] w-full" />
      </ul>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title={`No results for "${query}"`}
        description="Try a shorter name fragment or clear search to return to the folder tree."
        action={
          <Button variant="outline" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {results.map((node) => (
        <SearchResultRow
          key={node.id}
          dataroomId={dataroomId}
          dataroomName={dataroomName}
          node={node}
          allNodes={allNodes}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  );
}

interface SearchResultRowProps {
  dataroomId: string;
  dataroomName: string;
  node: DataroomNode;
  allNodes: readonly DataroomNode[];
  onOpenFile: (file: FileNode) => void;
}

function SearchResultRow({
  dataroomId,
  dataroomName,
  node,
  allNodes,
  onOpenFile,
}: Readonly<SearchResultRowProps>) {
  const location = getLocationLabel(allNodes, node, dataroomName);
  const meta =
    node.type === 'file' ? `${formatFileSize(node.size)} in ${location}` : `Folder in ${location}`;

  const content = (
    <>
      <span className="block truncate font-medium group-hover:underline">{node.name}</span>
      <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      <span className="block text-xs text-muted-foreground">
        Updated {formatDate(node.updatedAt)}
      </span>
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
          search={{}}
          className="min-w-0 flex-1 outline-none"
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onOpenFile(node)}
          className="min-w-0 flex-1 cursor-pointer text-left outline-none"
        >
          {content}
        </button>
      )}
    </li>
  );
}

function getLocationLabel(
  allNodes: readonly DataroomNode[],
  node: DataroomNode,
  dataroomName: string,
): string {
  const parentPath = folderPath(allNodes, node.parentId);
  if (parentPath.length === 0) return dataroomName;
  return `${dataroomName} / ${parentPath.map((folder) => folder.name).join(' / ')}`;
}
