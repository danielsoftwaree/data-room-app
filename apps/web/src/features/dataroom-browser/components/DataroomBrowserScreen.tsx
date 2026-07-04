import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  getApiErrorMessage,
  useGetDataroom,
  useListActivity,
  useListMembers,
  useListNodes,
  useListUsers,
} from '@repo/api-client';
import type { ActivityDto, UserDto } from '@repo/api-client';
import { UPLOAD } from '@repo/config';
import type { DataroomNode, FileNode } from '@repo/domain';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Checkbox } from '@repo/ui/components/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@repo/ui/components/context-menu';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { FilePdfIcon, FolderIcon as FolderFillIcon, VaultIcon } from '@phosphor-icons/react';
import {
  BellIcon,
  CheckIcon,
  CheckSquareIcon,
  EyeIcon,
  FilterIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  Grid2X2Icon,
  LinkIcon,
  ListIcon,
  MoreVerticalIcon,
  MoveIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { NameDialog } from '../../../shared/NameDialog';
import { UserMenu } from '../../../shared/UserMenu';
import { useFavorites } from '../../../shared/favorites';
import { formatCount, formatDate, formatFileSize } from '../../../shared/format';
import { childrenOf, findNode, folderPath } from '../../../shared/node-tree';
import { toDataroomNode } from '../../../shared/api-adapters';
import { useUiStore } from '../../../shared/ui-store';
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
  /** A node to reveal on first render (from a favorites deep-link, `?select=`). */
  selectNodeId?: string | null;
  onSearchTermChange: (term: string) => void;
  /** Called once the select target has been revealed, so the URL param can clear. */
  onConsumeSelect?: () => void;
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
  selectNodeId,
  onSearchTermChange,
  onConsumeSelect,
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
  const favorites = useFavorites();
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
  const view = useUiStore((state) => state.view);
  const setViewMode = useUiStore((state) => state.setView);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [contextNode, setContextNode] = useState<DataroomNode | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DataroomNode | null>(null);
  const [moveTargets, setMoveTargets] = useState<DataroomNode[] | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<FileNode | null>(null);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Fires the `?select` reveal exactly once per folder mount (no effect needed).
  const revealedRef = useRef(false);

  const { createFolder, createFile, renameNode, deleteNode, moveNode } =
    useNodeMutations(dataroomId);

  const visibleNodes = useMemo(
    () => sortVisibleNodes(filterNodes(baseNodes, filter), sortKey, sortDir),
    [baseNodes, filter, sortKey, sortDir],
  );
  const selectedNodes = visibleNodes.filter((node) => selectedIds.has(node.id));
  // The detail panel follows a single click (preview), independent of checkbox selection.
  const previewNode = previewNodeId ? (findNode(nodes, previewNodeId) ?? null) : null;
  const dataroomName = dataroom.data?.data.name ?? 'Data room';
  const myRole = dataroom.data?.data.myRole;
  const canEdit = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';
  const memberCount = members.data?.data.length ?? 0;
  const isRoomFavorite = favorites.isFavorite(dataroomId);
  const siblingNames = children.map((node) => node.name);

  // Reveal the `?select` target once: scroll it into view and open its details.
  function revealNode(node: DataroomNode, element: HTMLElement | null): void {
    if (revealedRef.current || !element || node.id !== selectNodeId) return;
    revealedRef.current = true;
    element.scrollIntoView({ block: 'center' });
    setPreviewNodeId(node.id);
    onConsumeSelect?.();
  }

  const isLoading = dataroom.isPending || nodesQuery.isPending;
  const isError =
    dataroom.isError || nodesQuery.isError || (isSearchActive && searchNodesQuery.isError);
  const browserError =
    dataroom.error ?? nodesQuery.error ?? (isSearchActive ? searchNodesQuery.error : null);

  // Single click previews the item (opens the detail panel); double click opens it.
  // Selection (row highlight, bulk actions) is driven only by the checkbox.
  function openPreview(node: DataroomNode): void {
    setPreviewNodeId(node.id);
  }

  // Checkbox selection; `extend` (shift-click) grows the range from the last-touched row.
  function toggleSelect(node: DataroomNode, extend: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (extend && lastSelectedId) {
        const from = visibleNodes.findIndex((candidate) => candidate.id === lastSelectedId);
        const to = visibleNodes.findIndex((candidate) => candidate.id === node.id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          for (const candidate of visibleNodes.slice(start, end + 1)) next.add(candidate.id);
          return next;
        }
      }
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    setLastSelectedId(node.id);
  }

  function copyLink(): void {
    void navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  }

  function selectAll(): void {
    setSelectedIds(new Set(visibleNodes.map((node) => node.id)));
  }

  // One context menu for the whole area: resolve which node (if any) was right-clicked
  // from the DOM so the menu always opens at the cursor with the right target.
  function handleAreaContextMenu(event: MouseEvent<HTMLElement>): void {
    const element = (event.target as HTMLElement).closest('[data-node-id]');
    const id = element?.getAttribute('data-node-id') ?? null;
    setContextNode(id ? (visibleNodes.find((node) => node.id === id) ?? null) : null);
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

  // Trash is reversible (Undo toast + Trash screen), so there is no confirm step.
  async function trashNodes(targets: readonly DataroomNode[]): Promise<void> {
    const roots = topLevelTargets(targets, nodes);
    for (const target of roots) {
      await deleteNode.mutateAsync({ id: target.id });
    }
    setSelectedIds(new Set());
    if (previewNodeId && roots.some((target) => target.id === previewNodeId)) {
      setPreviewNodeId(null);
    }
  }

  async function confirmMove(parentId: string | null): Promise<void> {
    if (!moveTargets) return;
    for (const target of moveTargets) {
      await moveNode.mutateAsync({ id: target.id, data: { parentId } });
    }
    setSelectedIds(new Set());
    setMoveTargets(null);
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
        if (event.key === 'Escape') {
          setSelectedIds(new Set());
          setPreviewNodeId(null);
        }
      }}
    >
      <section className="relative flex min-w-0 flex-1 flex-col">
        <RoomHeader
          name={currentFolder?.name ?? dataroomName}
          kind={currentFolder ? 'folder' : 'room'}
          memberCount={memberCount}
          isFavorite={isRoomFavorite}
          searchTerm={searchTerm}
          activity={recentActivity.data?.data ?? []}
          onToggleFavorite={() => favorites.toggle(dataroomId)}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Copy link" onClick={copyLink}>
                    <LinkIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy link</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          <Toolbar
            filter={filter}
            sortKey={sortKey}
            sortDir={sortDir}
            view={view}
            canEdit={canEdit}
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

          <ContextMenu>
            <ContextMenuTrigger asChild onContextMenu={handleAreaContextMenu}>
              <div className="flex flex-1 flex-col">
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
                  isSearchActive ? (
                    <EmptyState
                      title={`No results for "${activeSearch}"`}
                      description="Try a shorter name fragment, or clear the search to see everything."
                      action={
                        <Button variant="outline" onClick={() => onSearchTermChange('')}>
                          <XIcon className="size-4" />
                          Clear search
                        </Button>
                      }
                    />
                  ) : filter !== 'all' && children.length > 0 ? (
                    <EmptyState
                      title={`No ${filter} here`}
                      description={`This folder has items, but none match the "${filter}" filter.`}
                      action={
                        <Button variant="outline" onClick={() => setFilter('all')}>
                          <FilterIcon className="size-4" />
                          Clear filter
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="This folder is empty"
                      description={
                        canEdit
                          ? 'Create a subfolder or upload PDF files.'
                          : 'Nothing has been added here yet.'
                      }
                      action={
                        canEdit ? (
                          <Button onClick={() => fileInputRef.current?.click()}>
                            <UploadIcon className="size-4" />
                            Upload PDF
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                ) : view === 'list' ? (
                  <DocumentTable
                    nodes={visibleNodes}
                    uploadingNames={uploadingNames}
                    selectedIds={selectedIds}
                    usersById={usersById}
                    memberCount={memberCount}
                    canEdit={canEdit}
                    selectNodeId={selectNodeId}
                    isFavorite={(id) => favorites.isFavorite(dataroomId, id)}
                    onToggleFavorite={(id) => favorites.toggle(dataroomId, id)}
                    onReveal={revealNode}
                    onToggleSelect={toggleSelect}
                    onSelectRow={openPreview}
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
                    onDelete={(node) => void trashNodes([node])}
                  />
                ) : (
                  <DocumentGrid
                    nodes={visibleNodes}
                    selectedIds={selectedIds}
                    canEdit={canEdit}
                    selectNodeId={selectNodeId}
                    isFavorite={(id) => favorites.isFavorite(dataroomId, id)}
                    onToggleFavorite={(id) => favorites.toggle(dataroomId, id)}
                    onReveal={revealNode}
                    onToggleSelect={toggleSelect}
                    onSelectRow={openPreview}
                    onOpen={openNode}
                  />
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              {contextNode ? (
                <>
                  <ContextMenuItem onSelect={() => openNode(contextNode)}>
                    {contextNode.type === 'folder' ? <FolderOpenIcon /> : <EyeIcon />}
                    Open
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() =>
                      contextNode && favorites.toggle(dataroomId, contextNode.id)
                    }
                  >
                    <StarIcon />
                    {contextNode && favorites.isFavorite(dataroomId, contextNode.id)
                      ? 'Remove from favorites'
                      : 'Add to favorites'}
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={copyLink}>
                    <LinkIcon />
                    Copy link
                  </ContextMenuItem>
                  {canEdit ? (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => setRenameTarget(contextNode)}>
                        <PencilIcon />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => setMoveTargets([contextNode])}>
                        <MoveIcon />
                        Move
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => void trashNodes([contextNode])}
                      >
                        <Trash2Icon />
                        Move to trash
                      </ContextMenuItem>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <ContextMenuLabel>{currentFolder?.name ?? dataroomName}</ContextMenuLabel>
                  {canEdit ? (
                    <>
                      <ContextMenuItem
                        onSelect={() => {
                          createFolder.reset();
                          setCreateFolderOpen(true);
                        }}
                      >
                        <FolderPlusIcon />
                        New folder
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => fileInputRef.current?.click()}>
                        <UploadIcon />
                        Upload PDF
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                    </>
                  ) : null}
                  <ContextMenuItem onSelect={selectAll} disabled={visibleNodes.length === 0}>
                    <CheckSquareIcon />
                    Select all
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={copyLink}>
                    <LinkIcon />
                    Copy link
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => void nodesQuery.refetch()}>
                    <RefreshCwIcon />
                    Refresh
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        </div>

        {canEdit && selectedNodes.length > 0 ? (
          <BulkBar
            count={selectedNodes.length}
            onClear={() => setSelectedIds(new Set())}
            onMove={() => setMoveTargets(selectedNodes)}
            onDelete={() => void trashNodes(selectedNodes)}
          />
        ) : null}
      </section>

      {previewNode ? (
        <DetailPanel
          dataroomId={dataroomId}
          node={previewNode}
          allNodes={nodes}
          usersById={usersById}
          memberCount={memberCount}
          canEdit={canEdit}
          isFavorite={favorites.isFavorite(dataroomId, previewNode.id)}
          onToggleFavorite={() => favorites.toggle(dataroomId, previewNode.id)}
          onClose={() => setPreviewNodeId(null)}
          onRename={setRenameTarget}
          onMove={(targets) => setMoveTargets(targets)}
          onDelete={(targets) => void trashNodes(targets)}
          onOpenFile={setViewerFile}
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

      <MembersDialog
        dataroomId={dataroomId}
        isOwner={isOwner}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />

      <PdfViewerDialog file={viewerFile} onClose={() => setViewerFile(null)} />
    </main>
  );
}

interface RoomHeaderProps {
  name: string;
  kind: 'room' | 'folder';
  memberCount: number;
  isFavorite: boolean;
  searchTerm: string;
  activity: readonly ActivityDto[];
  onToggleFavorite: () => void;
  onOpenMembers: () => void;
  onSearch: (term: string) => void;
}

function RoomHeader({
  name,
  kind,
  memberCount,
  isFavorite,
  searchTerm,
  activity,
  onToggleFavorite,
  onOpenMembers,
  onSearch,
}: Readonly<RoomHeaderProps>) {
  return (
    <header className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-4 border-b bg-card px-4 py-3 sm:px-6">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        {kind === 'folder' ? (
          <FolderFillIcon weight="fill" className="size-5" />
        ) : (
          <VaultIcon weight="fill" className="size-5" />
        )}
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

      <UserMenu compact />
    </header>
  );
}

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

function Toolbar(props: Readonly<ToolbarProps>) {
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

function DocumentTable(props: Readonly<DocumentTableProps>) {
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
        {node.type === 'file' ? formatFileSize(node.size) : '—'}
      </span>
      <span className="truncate">{owner?.name ?? '—'}</span>
      <span className="text-muted-foreground">{formatCount(memberCount, 'member')}</span>
      <span className="flex items-center justify-end gap-0.5">
        <FavoriteButton
          favorite={isFavorite(node.id)}
          onToggle={() => onToggleFavorite(node.id)}
        />
        {canEdit ? (
          <RowActions node={node} onRename={onRename} onMove={onMove} onDelete={onDelete} />
        ) : null}
      </span>
    </div>
  );
}

/** Star toggle: always visible when starred, hover/focus-revealed otherwise. */
function FavoriteButton({
  favorite,
  onToggle,
}: Readonly<{ favorite: boolean; onToggle: () => void }>) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorite}
      className={cn(
        'transition-opacity',
        favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <StarIcon
        className={cn('size-4', favorite ? 'fill-primary text-primary' : 'text-muted-foreground')}
      />
    </Button>
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
  canEdit,
  selectNodeId,
  isFavorite,
  onToggleFavorite,
  onReveal,
  onToggleSelect,
  onSelectRow,
  onOpen,
}: Readonly<{
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
}>) {
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

function BulkBar({
  count,
  onClear,
  onMove,
  onDelete,
}: Readonly<{ count: number; onClear: () => void; onMove: () => void; onDelete: () => void }>) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex animate-in items-center gap-1 rounded-full border bg-card/95 py-1.5 pr-1.5 pl-4 shadow-lg fade-in slide-in-from-bottom-2 supports-[backdrop-filter]:bg-card/80 supports-[backdrop-filter]:backdrop-blur">
        <span className="text-sm font-medium whitespace-nowrap">{count} selected</span>
        <span className="mx-1.5 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onMove}>
          <MoveIcon className="size-4" />
          Move
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2Icon className="size-4" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <XIcon className="size-4" />
        </Button>
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

function activityText(entry: ActivityDto): string {
  const labels: Record<ActivityDto['action'], string> = {
    'dataroom.created': 'Data room created',
    'folder.created': 'Folder created',
    'file.uploaded': 'File uploaded',
    'node.renamed': 'Renamed',
    'node.moved': 'Moved',
    'node.deleted': 'Deleted',
    'node.restored': 'Restored',
    'member.added': 'Member added',
    'member.removed': 'Member removed',
    'member.updated': 'Member updated',
  };
  return entry.nodeName ? `${labels[entry.action]} - ${entry.nodeName}` : labels[entry.action];
}
