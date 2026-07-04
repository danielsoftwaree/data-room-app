import { getApiErrorMessage, useGetNodeContent, useListActivity } from '@repo/api-client';
import type { ActivityDto, UserDto } from '@repo/api-client';
import type { DataroomNode, FileNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import { Skeleton } from '@repo/ui/components/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs';
import { FileTextIcon, FolderIcon, PencilIcon, Trash2Icon, XIcon, MoveIcon } from 'lucide-react';
import { childrenOf, folderPath, subtreeCounts } from '../../../shared/node-tree';
import { formatCount, formatDate, formatFileSize } from '../../../shared/format';
import { useObjectUrl } from '../../../shared/use-object-url';

interface DetailPanelProps {
  dataroomId: string;
  node: DataroomNode;
  allNodes: readonly DataroomNode[];
  usersById: ReadonlyMap<string, UserDto>;
  memberCount: number;
  onClose: () => void;
  onRename: (node: DataroomNode) => void;
  onMove: (nodes: DataroomNode[]) => void;
  onDelete: (nodes: DataroomNode[]) => void;
}

export function DetailPanel({
  dataroomId,
  node,
  allNodes,
  usersById,
  memberCount,
  onClose,
  onRename,
  onMove,
  onDelete,
}: Readonly<DetailPanelProps>) {
  const owner = node.createdBy ? usersById.get(node.createdBy) : undefined;
  const path = folderPath(allNodes, node.parentId).map((folder) => folder.name);
  const counts = node.type === 'folder' ? subtreeCounts(allNodes, node.id) : null;

  return (
    <aside className="hidden w-[360px] shrink-0 border-l bg-card lg:flex lg:flex-col">
      <header className="flex h-16 items-center gap-3 border-b px-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          {node.type === 'folder' ? (
            <FolderIcon className="size-4" />
          ) : (
            <FileTextIcon className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{node.name}</h2>
          <p className="text-xs text-muted-foreground">
            {node.type === 'folder' ? 'Folder' : 'PDF Document'}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </header>

      <Tabs defaultValue="preview" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="mx-4 mt-3">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="min-h-0 overflow-auto p-4">
          {node.type === 'file' ? (
            <PdfPreview file={node} />
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
        </TabsContent>

        <TabsContent value="details" className="overflow-auto p-4">
          <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-4 text-sm">
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
    </aside>
  );
}

function PdfPreview({ file }: Readonly<{ file: FileNode }>) {
  const content = useGetNodeContent(file.id);
  const blob = content.data?.data instanceof Blob ? content.data.data : null;
  const objectUrl = useObjectUrl(blob);

  if (content.isPending) return <Skeleton className="h-[360px] w-full" />;
  if (content.isError || !objectUrl) {
    return (
      <p role="alert" className="rounded-lg border p-4 text-sm text-destructive">
        {content.isError ? getApiErrorMessage(content.error) : 'Could not display this PDF.'}
      </p>
    );
  }
  return (
    <iframe title={file.name} src={objectUrl} className="h-[360px] w-full rounded-lg border" />
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

function activityLabel(entry: ActivityDto): string {
  const labels: Record<ActivityDto['action'], string> = {
    'dataroom.created': 'Data room created',
    'folder.created': 'Folder created',
    'file.uploaded': 'File uploaded',
    'node.renamed': 'Renamed',
    'node.moved': 'Moved',
    'node.deleted': 'Deleted',
    'member.added': 'Member added',
    'member.removed': 'Member removed',
  };
  return entry.nodeName ? `${labels[entry.action]} - ${entry.nodeName}` : labels[entry.action];
}
