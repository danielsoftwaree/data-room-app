import { useState } from 'react';
import { getApiErrorMessage, useGetNodeContent, useListActivity } from '@repo/api-client';
import type { UserDto } from '@repo/api-client';
import type { DataroomNode, FileNode } from '@repo/domain';
import { FilePdfIcon, FolderIcon } from '@phosphor-icons/react';
import { Button } from '@repo/ui/components/button';
import { Skeleton } from '@repo/ui/components/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { cn } from '@repo/ui/lib/utils';
import { Maximize2Icon, PencilIcon, StarIcon, Trash2Icon, XIcon, MoveIcon } from 'lucide-react';
import { childrenOf, folderPath, subtreeCounts } from '../helpers/node-tree';
import { formatCount, formatDate, formatFileSize } from '@/shared/lib/format';
import { PdfDocument, PdfPage } from '@/shared/lib/pdf-viewer';
import { useObjectUrl } from '@/shared/hooks/use-object-url';
import { activityLabel } from '../helpers/activity-label';

interface DetailPanelProps {
  dataroomId: string;
  node: DataroomNode;
  allNodes: readonly DataroomNode[];
  usersById: ReadonlyMap<string, UserDto>;
  memberCount: number;
  canEdit: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onRename: (node: DataroomNode) => void;
  onMove: (nodes: DataroomNode[]) => void;
  onDelete: (nodes: DataroomNode[]) => void;
  onOpenFile: (file: FileNode) => void;
}

export function DetailPanel({
  dataroomId,
  node,
  allNodes,
  usersById,
  memberCount,
  canEdit,
  isFavorite,
  onToggleFavorite,
  onClose,
  onRename,
  onMove,
  onDelete,
  onOpenFile,
}: Readonly<DetailPanelProps>) {
  const owner = node.createdBy ? usersById.get(node.createdBy) : undefined;
  const path = folderPath(allNodes, node.parentId).map((folder) => folder.name);
  const counts = node.type === 'folder' ? subtreeCounts(allNodes, node.id) : null;

  return (
    <aside className="hidden w-[360px] shrink-0 border-l bg-card lg:flex lg:flex-col">
      <header className="flex h-16 items-center gap-3 border-b px-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          {node.type === 'folder' ? (
            <FolderIcon weight="fill" className="size-4" />
          ) : (
            <FilePdfIcon weight="fill" className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{node.name}</h2>
          <p className="text-xs text-muted-foreground">
            {node.type === 'folder' ? 'Folder' : 'PDF Document'}
          </p>
        </div>
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
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </header>

      <Tabs defaultValue="preview" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="mx-4 mt-3">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="min-h-0 space-y-4 overflow-auto p-4">
          {node.type === 'file' ? (
            <PdfPreview file={node} onOpenFull={() => onOpenFile(node)} />
          ) : (
            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-sm font-medium">Folder summary</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatCount(counts?.folders ?? 0, 'folder')} and{' '}
                {formatCount(counts?.files ?? 0, 'file')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCount(childrenOf(allNodes, node.id).length, 'direct item')}
              </p>
            </div>
          )}

          <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-3 border-t pt-4 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{node.type === 'folder' ? 'Folder' : 'PDF Document'}</dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{node.type === 'file' ? formatFileSize(node.size) : '—'}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{formatDate(node.updatedAt)}</dd>
            <dt className="text-muted-foreground">Uploaded by</dt>
            <dd>{owner?.name ?? '—'}</dd>
            <dt className="text-muted-foreground">Access</dt>
            <dd>{formatCount(memberCount, 'member')}</dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd className="break-words">{path.length ? `/${path.join('/')}` : '/Root'}</dd>
          </dl>
        </TabsContent>

        <TabsContent value="activity" className="overflow-auto p-4">
          <ActivityList dataroomId={dataroomId} nodeId={node.id} />
        </TabsContent>
      </Tabs>

      {canEdit ? (
        <footer className="grid grid-cols-3 gap-2 border-t p-4">
          <Button variant="outline" onClick={() => onRename(node)}>
            <PencilIcon className="size-4" />
            Rename
          </Button>
          <Button variant="outline" onClick={() => onMove([node])}>
            <MoveIcon className="size-4" />
            Move
          </Button>
          <Button variant="outline" className="text-destructive" onClick={() => onDelete([node])}>
            <Trash2Icon className="size-4" />
            Delete
          </Button>
        </footer>
      ) : null}
    </aside>
  );
}

/** Static first-page preview: no scrolling here — the full viewer opens on demand. */
function PdfPreview({ file, onOpenFull }: Readonly<{ file: FileNode; onOpenFull: () => void }>) {
  const content = useGetNodeContent(file.id);
  const blob = content.data?.data instanceof Blob ? content.data.data : null;
  const objectUrl = useObjectUrl(blob);
  const [pageCount, setPageCount] = useState<number | null>(null);

  if (content.isPending) return <Skeleton className="h-[360px] w-full" />;
  if (content.isError || !objectUrl) {
    return (
      <p role="alert" className="rounded-lg border p-4 text-sm text-destructive">
        {content.isError ? getApiErrorMessage(content.error) : 'Could not display this PDF.'}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-background/60">
      <div className="group relative">
        <div className="pointer-events-none select-none">
          <PdfDocument
            file={objectUrl}
            onLoadSuccess={(document) => setPageCount(document.numPages)}
            loading={<Skeleton className="h-[320px] w-full" />}
            error={
              <p role="alert" className="p-4 text-sm text-destructive">
                Could not display this PDF.
              </p>
            }
          >
            <PdfPage
              pageNumber={1}
              width={326}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </PdfDocument>
        </div>
        {/* Hover/focus reveals a clear call-to-action over the static thumbnail. */}
        <button
          type="button"
          onClick={onOpenFull}
          aria-label="Open full document"
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-all group-hover:bg-foreground/35 group-hover:opacity-100 focus-visible:bg-foreground/35 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <span className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-md">
            <Maximize2Icon className="size-4" />
            Open
          </span>
        </button>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-1.5">
        <span className="text-xs text-muted-foreground">
          {pageCount === null ? 'Loading…' : `Page 1 of ${pageCount}`}
        </span>
        <Button variant="ghost" size="xs" onClick={onOpenFull}>
          Open
        </Button>
      </div>
    </div>
  );
}

function ActivityList({ dataroomId, nodeId }: Readonly<{ dataroomId: string; nodeId: string }>) {
  const activity = useListActivity(dataroomId, { nodeId, limit: 15 });
  if (activity.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (activity.isError) {
    return <p className="text-sm text-destructive">{getApiErrorMessage(activity.error)}</p>;
  }
  if (activity.data.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity for this item yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {activity.data.data.map((entry) => (
        <li key={entry.id} className="rounded-lg border bg-background/60 p-3">
          <p className="text-sm font-medium">{activityLabel(entry)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entry.actor.name} - {formatDate(entry.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
