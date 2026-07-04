import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  getApiErrorMessage,
  useAddFavorite,
  useGetDataroom,
  useGetMe,
  useListActivity,
  useListFavorites,
  useListMembers,
  useListNodes,
  useListUsers,
  useRemoveFavorite,
} from '@repo/api-client';
import type { ActivityDto, UserDto } from '@repo/api-client';
import { UPLOAD } from '@repo/config';
import type { DataroomNode, FileNode } from '@repo/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Input } from '@repo/ui/components/input';
import { Progress } from '@repo/ui/components/progress';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { cn } from '@repo/ui/lib/utils';
import {
  BellIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  FilterIcon,
  FolderIcon,
  FolderPlusIcon,
  Grid2X2Icon,
  ListIcon,
  MoreVerticalIcon,
  MoveIcon,
  PencilIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { NameDialog } from '../../../shared/NameDialog';
import { formatCount, formatDate, formatFileSize } from '../../../shared/format';
import { childrenOf, findNode, folderPath, subtreeCounts } from '../../../shared/node-tree';
import { toDataroomNode } from '../../../shared/api-adapters';
import { useNodeMutations } from '../hooks';
import { DataroomBreadcrumbs } from './Breadcrumbs';
import { DetailPanel } from './DetailPanel';
import { MembersDialog } from './MembersDialog';
import { MoveDialog } from './MoveDialog';
import { PdfViewerDialog } from './PdfViewerDialog';

interface DataroomBrowserScreenProps {
  dataroomId: string;
  folderId: string | null;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

type FilterMode = 'all' | 'folders' | 'files';
type SortKey = 'name' | 'updated' | 'size';

const SORT_LABELS: Record<SortKey, string> = { name: 'Name', updated: 'Updated', size: 'Size' };
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

export function DataroomBrowserScreen(props: Readonly<DataroomBrowserScreenProps>) {
  return <DocumentsWorkspace key={`${props.dataroomId}:${props.folderId ?? 'root'}`} {...props} />;
}

function DocumentsWorkspace({
  dataroomId,
  folderId,
  searchTerm,
  onSearchTermChange,
}: Readonly<DataroomBrowserScreenProps>) {
  const navigate = useNavigate();
  const dataroom = useGetDataroom(dataroomId);
  const nodesQuery = useListNodes(dataroomId);
  const activeSearch = searchTerm.trim();
  const isSearchActive = activeSearch.length > 0;
  const searchNodesQuery = useListNodes(
    dataroomId,
    isSearchActive ? { search: activeSearch } : undefined,
    { query: { enabled: isSearchActive } },
  );
  const members = useListMembers(dataroomId);
  const users = useListUsers();
  const me = useGetMe();
  const favorites = useListFavorites();
  const recentActivity = useListActivity(dataroomId, { limit: 15 });

  const nodes = useMemo(() => (nodesQuery.data?.data ?? []).map(toDataroomNode), [nodesQuery.data]);
  const searchResults = useMemo(
    () => (searchNodesQuery.data?.data ?? []).map(toDataroomNode),
    [searchNodesQuery.data],
  );
  const usersById = useMemo(
    () => new Map((users.data?.data ?? []).map((user) => [user.id, user] as const)),
    [users.data],
  );

  const currentFolder = folderId !== null ? findNode(nodes, folderId) : undefined;
  const folderMissing = folderId !== null && nodesQuery.isSuccess && !currentFolder;
  const path = useMemo(() => folderPath(nodes, folderId), [nodes, folderId]);
  const children = useMemo(() => childrenOf(nodes, folderId), [nodes, folderId]);
  const baseNodes = isSearchActive ? searchResults : children;

  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem('dataroom-view') === 'grid' ? 'grid' : 'list',
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DataroomNode | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<DataroomNode[] | null>(null);
  const [moveTargets, setMoveTargets] = useState<DataroomNode[] | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<FileNode | null>(null);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createFolder, createFile, renameNode, deleteNode, moveNode } =
    useNodeMutations(dataroomId);
  const addFavorite = useAddFavorite({
    mutation: { onSuccess: () => void favorites.refetch() },
  });
  const removeFavorite = useRemoveFavorite({
    mutation: { onSuccess: () => void favorites.refetch() },
  });

  const visibleNodes = useMemo(
    () => sortVisibleNodes(filterNodes(baseNodes, filter), sortKey, sortDir),
    [baseNodes, filter, sortKey, sortDir],
  );
  const selectedNodes = visibleNodes.filter((node) => selectedIds.has(node.id));
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const dataroomName = dataroom.data?.data.name ?? 'Data room';
  const memberCount = members.data?.data.length ?? 0;
  const isRoomFavorite = (favorites.data?.data ?? []).some(
    (favorite) => favorite.dataroomId === dataroomId && favorite.nodeId === null,
  );
  const siblingNames = children.map((node) => node.name);

  const isLoading = dataroom.isPending || nodesQuery.isPending;
  const isError =
    dataroom.isError || nodesQuery.isError || (isSearchActive && searchNodesQuery.isError);
  const browserError =
    dataroom.error ?? nodesQuery.error ?? (isSearchActive ? searchNodesQuery.error : null);

  function setViewMode(nextView: ViewMode): void {
    setView(nextView);
    localStorage.setItem('dataroom-view', nextView);
  }

  function handleRowClick(node: DataroomNode, event: MouseEvent): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (event.shiftKey && lastSelectedId) {
        const from = visibleNodes.findIndex((candidate) => candidate.id === lastSelectedId);
        const to = visibleNodes.findIndex((candidate) => candidate.id === node.id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          for (const candidate of visibleNodes.slice(start, end + 1)) next.add(candidate.id);
          return next;
        }
      }
      if (event.ctrlKey || event.metaKey) {
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      }
      return new Set([node.id]);
    });
    setLastSelectedId(node.id);
  }

  function openNode(node: DataroomNode): void {
    if (node.type === 'folder') {
      void navigate({
        to: '/datarooms/$dataroomId/folders/$folderId',
        params: { dataroomId, folderId: node.id },
        search: {},
      });
      return;
    }
    setViewerFile(node);
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const accepted: File[] = [];
    const failures: string[] = [];
    for (const file of files) {
      if (!UPLOAD.acceptedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        failures.push(`${file.name}: only PDF files are allowed`);
      } else if (file.size > UPLOAD.maxFileSizeBytes) {
        failures.push(
          `${file.name}: larger than the ${formatFileSize(UPLOAD.maxFileSizeBytes)} limit`,
        );
      } else {
        accepted.push(file);
      }
    }
    setUploadingNames(accepted.map((file) => file.name));
    let succeeded = 0;
    for (const file of accepted) {
      try {
        await createFile.mutateAsync({ id: dataroomId, data: { parentId: folderId, file } });
        succeeded += 1;
      } catch (error) {
        failures.push(`${file.name}: ${getApiErrorMessage(error)}`);
      }
      setUploadingNames((names) => names.filter((name) => name !== file.name));
    }
    if (succeeded > 0) toast.success(`${succeeded} file(s) uploaded`);
    if (failures.length > 0) toast.error(failures.slice(0, 5).join('\n'));
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTargets) return;
    for (const target of topLevelTargets(deleteTargets, nodes)) {
      await deleteNode.mutateAsync({ id: target.id });
    }
    setSelectedIds(new Set());
    setDeleteTargets(null);
  }

  async function confirmMove(parentId: string | null): Promise<void> {
    if (!moveTargets) return;
    for (const target of moveTargets) {
      await moveNode.mutateAsync({ id: target.id, data: { parentId } });
    }
    setSelectedIds(new Set());
    setMoveTargets(null);
  }

  function toggleRoomFavorite(): void {
    const data = { dataroomId, nodeId: null };
    if (isRoomFavorite) removeFavorite.mutate({ data });
    else addFavorite.mutate({ data });
  }

  if (isError) {
    return (
      <main className="p-6">
        <EmptyState
          title="Could not load this data room"
          description={getApiErrorMessage(browserError)}
        />
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen min-w-0 flex-col bg-background xl:h-screen xl:flex-row"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setSelectedIds(new Set());
      }}
    >
      <section className="flex min-w-0 flex-1 flex-col">
        <RoomHeader
          name={currentFolder?.name ?? dataroomName}
          memberCount={memberCount}
          isFavorite={isRoomFavorite}
          searchTerm={searchTerm}
          currentUser={me.data?.data}
          activity={recentActivity.data?.data ?? []}
          onToggleFavorite={toggleRoomFavorite}
          onOpenMembers={() => setMembersOpen(true)}
          onSearch={onSearchTermChange}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
          {!isLoading && !folderMissing ? (
            <div className="flex items-center justify-between gap-3">
              <DataroomBreadcrumbs
                dataroomId={dataroomId}
                dataroomName={dataroomName}
                path={path}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy link"
                onClick={() => {
                  void navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copied');
                }}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          ) : null}

          <Toolbar
            filter={filter}
            sortKey={sortKey}
            sortDir={sortDir}
            view={view}
            uploading={uploadingNames.length > 0}
            onFilter={setFilter}
            onSortKey={setSortKey}
            onSortDir={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}
            onView={setViewMode}
            onCreateFolder={() => {
              createFolder.reset();
              setCreateFolderOpen(true);
            }}
            onUpload={() => fileInputRef.current?.click()}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
              event.target.value = '';
            }}
          />

          {isLoading ? (
            <div className="flex flex-col gap-2" aria-busy>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : folderMissing ? (
            <EmptyState
              title="Folder not found"
              description="This folder may have been moved or deleted."
            />
          ) : visibleNodes.length === 0 && uploadingNames.length === 0 ? (
            <EmptyState
              title={isSearchActive ? `No results for "${activeSearch}"` : 'This folder is empty'}
              description={
                isSearchActive
                  ? 'Try a shorter name fragment or clear search.'
                  : 'Create a subfolder or upload PDF files.'
              }
              action={
                <Button onClick={() => fileInputRef.current?.click()}>
                  <UploadIcon className="size-4" />
                  Upload PDF
                </Button>
              }
            />
          ) : view === 'list' ? (
            <DocumentTable
              nodes={visibleNodes}
              uploadingNames={uploadingNames}
              selectedIds={selectedIds}
              usersById={usersById}
              memberCount={memberCount}
              onSelect={handleRowClick}
              onOpen={openNode}
              onToggleAll={() =>
                setSelectedIds((current) =>
                  visibleNodes.every((node) => current.has(node.id))
                    ? new Set()
                    : new Set(visibleNodes.map((node) => node.id)),
                )
              }
              onRename={setRenameTarget}
              onMove={(node) => setMoveTargets([node])}
              onDelete={(node) => setDeleteTargets([node])}
            />
          ) : (
            <DocumentGrid
              nodes={visibleNodes}
              selectedIds={selectedIds}
              onSelect={handleRowClick}
              onOpen={openNode}
            />
          )}
        </div>

        {selectedNodes.length > 0 ? (
          <BulkBar
            count={selectedNodes.length}
            onClear={() => setSelectedIds(new Set())}
            onMove={() => setMoveTargets(selectedNodes)}
            onDelete={() => setDeleteTargets(selectedNodes)}
          />
        ) : null}
      </section>

      {selectedNode ? (
        <DetailPanel
          dataroomId={dataroomId}
          node={selectedNode}
          allNodes={nodes}
          usersById={usersById}
          memberCount={memberCount}
          onClose={() => setSelectedIds(new Set())}
          onRename={setRenameTarget}
          onMove={(targets) => setMoveTargets(targets)}
          onDelete={(targets) => setDeleteTargets(targets)}
        />
      ) : null}

      <NameDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        title="New folder"
        label="Folder name"
        submitLabel="Create"
        placeholder="e.g. Financials"
        existingNames={siblingNames}
        pending={createFolder.isPending}
        serverError={createFolder.isError ? getApiErrorMessage(createFolder.error) : null}
        onSubmit={(name) =>
          createFolder.mutate(
            { id: dataroomId, data: { parentId: folderId, name } },
            { onSuccess: () => setCreateFolderOpen(false) },
          )
        }
      />

      <NameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title={renameTarget?.type === 'folder' ? 'Rename folder' : 'Rename file'}
        label="Name"
        submitLabel="Rename"
        initialName={renameTarget?.name ?? ''}
        existingNames={siblingNames.filter((name) => name !== renameTarget?.name)}
        pending={renameNode.isPending}
        serverError={renameNode.isError ? getApiErrorMessage(renameNode.error) : null}
        onSubmit={(name) => {
          if (!renameTarget) return;
          renameNode.mutate(
            { id: renameTarget.id, data: { name } },
            { onSuccess: () => setRenameTarget(null) },
          );
        }}
      />

      <MoveDialog
        open={moveTargets !== null}
        nodes={nodes}
        targets={moveTargets ?? []}
        pending={moveNode.isPending}
        onOpenChange={(open) => {
          if (!open) setMoveTargets(null);
        }}
        onMove={(parentId) => void confirmMove(parentId)}
      />

      <MembersDialog dataroomId={dataroomId} open={membersOpen} onOpenChange={setMembersOpen} />

      <AlertDialog
        open={deleteTargets !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deleteTargets?.length === 1
                ? `"${deleteTargets[0].name}"`
                : `${deleteTargets?.length ?? 0} items`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDescription(deleteTargets ?? [], nodes)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteNode.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteNode.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PdfViewerDialog file={viewerFile} onClose={() => setViewerFile(null)} />
    </main>
  );
}

interface RoomHeaderProps {
  name: string;
  memberCount: number;
  isFavorite: boolean;
  searchTerm: string;
  currentUser: UserDto | undefined;
  activity: readonly ActivityDto[];
  onToggleFavorite: () => void;
  onOpenMembers: () => void;
  onSearch: (term: string) => void;
}

function RoomHeader({
  name,
  memberCount,
  isFavorite,
  searchTerm,
  currentUser,
  activity,
  onToggleFavorite,
  onOpenMembers,
  onSearch,
}: Readonly<RoomHeaderProps>) {
  return (
    <header className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-4 border-b bg-card px-4 py-3 sm:px-6">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <FolderIcon className="size-5" />
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
                <span>{activityText(entry)}</span>
                <span className="text-xs text-muted-foreground">{entry.actor.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {initials(currentUser?.name ?? '?')}
      </span>
    </header>
  );
}

interface ToolbarProps {
  filter: FilterMode;
  sortKey: SortKey;
  sortDir: SortDir;
  view: ViewMode;
  uploading: boolean;
  onFilter: (filter: FilterMode) => void;
  onSortKey: (sortKey: SortKey) => void;
  onSortDir: () => void;
  onView: (view: ViewMode) => void;
  onCreateFolder: () => void;
  onUpload: () => void;
}

function Toolbar(props: Readonly<ToolbarProps>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={props.onUpload} disabled={props.uploading}>
          <UploadIcon className="size-4" />
          {props.uploading ? 'Uploading...' : 'Upload'}
        </Button>
        <Button variant="outline" onClick={props.onCreateFolder}>
          <FolderPlusIcon className="size-4" />
          New Folder
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
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

interface DocumentTableProps {
  nodes: readonly DataroomNode[];
  uploadingNames: readonly string[];
  selectedIds: ReadonlySet<string>;
  usersById: ReadonlyMap<string, UserDto>;
  memberCount: number;
  onSelect: (node: DataroomNode, event: MouseEvent) => void;
  onOpen: (node: DataroomNode) => void;
  onToggleAll: () => void;
  onRename: (node: DataroomNode) => void;
  onMove: (node: DataroomNode) => void;
  onDelete: (node: DataroomNode) => void;
}

function DocumentTable(props: Readonly<DocumentTableProps>) {
  const allSelected =
    props.nodes.length > 0 && props.nodes.every((node) => props.selectedIds.has(node.id));
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[36px_minmax(260px,1.7fr)_160px_100px_160px_130px_40px] items-center border-b px-3 py-3 text-xs font-semibold text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={props.onToggleAll}
            aria-label="Select all"
          />
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
            <input type="checkbox" disabled aria-label={`Uploading ${name}`} />
            <div className="flex items-center gap-3">
              <FileTextIcon className="size-5 text-destructive" />
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
  onSelect,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: Readonly<DocumentTableProps & { node: DataroomNode }>) {
  const selected = selectedIds.has(node.id);
  const owner = node.createdBy ? usersById.get(node.createdBy) : undefined;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => onSelect(node, event)}
      onDoubleClick={() => onOpen(node)}
      className={cn(
        'grid grid-cols-[36px_minmax(260px,1.7fr)_160px_100px_160px_130px_40px] items-center border-t px-3 py-2.5 text-sm hover:bg-accent/40',
        selected ? 'bg-primary/10' : undefined,
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        aria-label={`Select ${node.name}`}
        onChange={() => undefined}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="flex min-w-0 items-center gap-3">
        {node.type === 'folder' ? (
          <FolderIcon className="size-5 text-primary" />
        ) : (
          <FileTextIcon className="size-5 text-destructive" />
        )}
        <span className="truncate font-medium">{node.name}</span>
      </div>
      <span className="text-muted-foreground">{formatDate(node.updatedAt)}</span>
      <span className="text-muted-foreground">
        {node.type === 'file' ? formatFileSize(node.size) : '—'}
      </span>
      <span className="truncate">{owner?.name ?? '—'}</span>
      <span className="text-muted-foreground">{formatCount(memberCount, 'member')}</span>
      <RowActions node={node} onRename={onRename} onMove={onMove} onDelete={onDelete} />
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

function DocumentGrid({
  nodes,
  selectedIds,
  onSelect,
  onOpen,
}: Readonly<{
  nodes: readonly DataroomNode[];
  selectedIds: ReadonlySet<string>;
  onSelect: (node: DataroomNode, event: MouseEvent) => void;
  onOpen: (node: DataroomNode) => void;
}>) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => onSelect(node, event)}
          onDoubleClick={() => onOpen(node)}
          className={cn(
            'flex aspect-[4/3] flex-col items-start justify-between rounded-lg border bg-card p-4 text-left hover:bg-accent/40',
            selectedIds.has(node.id) ? 'border-primary bg-primary/10' : undefined,
          )}
        >
          {node.type === 'folder' ? (
            <FolderIcon className="size-7 text-primary" />
          ) : (
            <FileTextIcon className="size-7 text-destructive" />
          )}
          <span className="line-clamp-2 text-sm font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground">{formatDate(node.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}

function BulkBar({
  count,
  onClear,
  onMove,
  onDelete,
}: Readonly<{ count: number; onClear: () => void; onMove: () => void; onDelete: () => void }>) {
  return (
    <div className="border-t bg-card px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{count} selected</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onMove}>
            <MoveIcon className="size-4" />
            Move
          </Button>
          <Button variant="outline" className="text-destructive" onClick={onDelete}>
            <Trash2Icon className="size-4" />
            Delete
          </Button>
          <Button variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function filterNodes(nodes: readonly DataroomNode[], filter: FilterMode): DataroomNode[] {
  if (filter === 'folders') return nodes.filter((node) => node.type === 'folder');
  if (filter === 'files') return nodes.filter((node) => node.type === 'file');
  return [...nodes];
}

function sortVisibleNodes(
  nodes: readonly DataroomNode[],
  sortKey: SortKey,
  dir: SortDir,
): DataroomNode[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    if (sortKey === 'updated') return (a.updatedAt - b.updatedAt) * factor;
    if (sortKey === 'size') {
      const aSize = a.type === 'file' ? a.size : 0;
      const bSize = b.type === 'file' ? b.size : 0;
      return (aSize - bSize) * factor;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * factor;
  });
}

function topLevelTargets(
  targets: readonly DataroomNode[],
  allNodes: readonly DataroomNode[],
): DataroomNode[] {
  const selected = new Set(targets.map((target) => target.id));
  return targets.filter((target) => {
    let current = target.parentId ? findNode(allNodes, target.parentId) : undefined;
    while (current) {
      if (selected.has(current.id)) return false;
      current = current.parentId ? findNode(allNodes, current.parentId) : undefined;
    }
    return true;
  });
}

function deleteDescription(
  targets: readonly DataroomNode[],
  allNodes: readonly DataroomNode[],
): string {
  if (targets.length === 0) return 'Nothing selected.';
  let folders = 0;
  let files = 0;
  for (const target of topLevelTargets(targets, allNodes)) {
    if (target.type === 'folder') {
      folders += 1;
      const counts = subtreeCounts(allNodes, target.id);
      folders += counts.folders;
      files += counts.files;
    } else {
      files += 1;
    }
  }
  return `This permanently deletes ${formatCount(folders, 'folder')} and ${formatCount(files, 'file')}. This cannot be undone.`;
}

function activityText(entry: ActivityDto): string {
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
