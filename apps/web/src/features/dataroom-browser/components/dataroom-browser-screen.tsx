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
import { UPLOAD } from '@repo/config';
import type { DataroomNode, FileNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@repo/ui/components/context-menu';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip';
import {
  CheckSquareIcon,
  EyeIcon,
  FilterIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LinkIcon,
  MoveIcon,
  PencilIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { NameDialog } from '../../../shared/NameDialog';
import { useFavorites } from '../../../shared/favorites';
import { formatFileSize } from '../../../shared/format';
import { childrenOf, findNode, folderPath } from '../../../shared/node-tree';
import { toDataroomNode } from '../../../shared/api-adapters';
import { useUiStore } from '../../../shared/ui-store';
import { filterNodes } from '../helpers/filter-nodes';
import { sortVisibleNodes } from '../helpers/sort-nodes';
import { topLevelTargets } from '../helpers/top-level-targets';
import { useNodeMutations } from '../hooks/use-node-mutations.mutation';
import type { FilterMode, SortDir, SortKey } from '../types';
import { DataroomBreadcrumbs } from './breadcrumbs';
import { BulkBar } from './bulk-bar';
import { DetailPanel } from './detail-panel';
import { DocumentGrid } from './document-grid';
import { DocumentTable } from './document-table';
import { MembersDialog } from './members-dialog';
import { MoveDialog } from './move-dialog';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { RoomHeader } from './room-header';
import { Toolbar } from './toolbar';

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
