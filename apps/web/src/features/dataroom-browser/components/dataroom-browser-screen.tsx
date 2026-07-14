import { useState, type MouseEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { getApiErrorMessage } from '@repo/api-client';
import type { DataroomNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import { ContextMenu, ContextMenuTrigger } from '@repo/ui/components/context-menu';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip';
import { LinkIcon, UploadIcon } from 'lucide-react';
import { useFavorites } from '@/features/favorites';
import { topLevelTargets } from '../helpers/top-level-targets';
import { useBrowserData } from '../hooks/use-browser-data.query';
import { useBrowserDialogs } from '../hooks/use-browser-dialogs';
import { useDropUpload } from '../hooks/use-drop-upload';
import { useFileUpload } from '../hooks/use-file-upload';
import { useNodeMutations } from '../hooks/use-node-mutations.mutation';
import { useNodePreview } from '../hooks/use-node-preview';
import { useNodeSelection } from '../hooks/use-node-selection';
import { useViewOptions } from '../hooks/use-view-options';
import { DataroomBreadcrumbs } from './breadcrumbs';
import { BrowserContextMenu } from './browser-context-menu';
import { BrowserDialogs } from './browser-dialogs';
import { BrowserEmptyState } from './browser-empty-state';
import { BulkBar } from './bulk-bar';
import { DetailPanel } from './detail-panel';
import { DocumentGrid } from './document-grid';
import { DocumentTable } from './document-table';
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
  // Keyed per room+folder: navigation remounts the workspace, so per-visit
  // state (selection, preview, filter/sort, dialogs) resets without effects.
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
  const data = useBrowserData(dataroomId, folderId, searchTerm);
  const favorites = useFavorites();
  const mutations = useNodeMutations(dataroomId);
  const view = useViewOptions(data.baseNodes);
  const selection = useNodeSelection(view.visibleNodes);
  const preview = useNodePreview({ nodes: data.nodes, selectNodeId, onConsumeSelect });
  const dialogs = useBrowserDialogs();
  // Destructured so render never touches the ref-carrying hook object itself.
  const { uploadingNames, isUploading, inputRef, openFilePicker, uploadFiles } = useFileUpload({
    dataroomId,
    folderId,
    createFile: mutations.createFile,
  });
  const dropUpload = useDropUpload({
    enabled: data.canEdit && !data.folderMissing,
    onDropFiles: (files) => void uploadFiles(files),
  });
  const [contextNode, setContextNode] = useState<DataroomNode | null>(null);

  const siblingNames = data.children.map((node) => node.name);
  const previewNode = preview.previewNode;

  function copyLink(): void {
    void navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  }

  // Public share link for an already-shared node — copied without opening the dialog.
  function copyShareLink(node: DataroomNode): void {
    if (!node.shareSlug) return;
    void navigator.clipboard.writeText(`${window.location.origin}/share/${node.shareSlug}`);
    toast.success('Link copied');
  }

  function openShare(node: DataroomNode): void {
    dialogs.openShare(node);
  }

  // One context menu for the whole area: resolve which node (if any) was
  // right-clicked from the DOM so the menu always opens at the cursor with the
  // right target.
  function handleAreaContextMenu(event: MouseEvent<HTMLElement>): void {
    const element = (event.target as HTMLElement).closest('[data-node-id]');
    const id = element?.getAttribute('data-node-id') ?? null;
    setContextNode(id ? (view.visibleNodes.find((node) => node.id === id) ?? null) : null);
  }

  // Single click previews the item (opens the detail panel); double click /
  // Enter opens it. Selection (row highlight, bulk actions) is checkbox-only.
  function openNode(node: DataroomNode): void {
    if (node.type === 'folder') {
      void navigate({
        to: '/datarooms/$dataroomId/folders/$folderId',
        params: { dataroomId, folderId: node.id },
        search: {},
      });
      return;
    }
    dialogs.openViewer(node);
  }

  // Trash is reversible (Undo toast + Trash screen), so there is no confirm step.
  async function trashNodes(targets: readonly DataroomNode[]): Promise<void> {
    const roots = topLevelTargets(targets, data.nodes);
    try {
      for (const target of roots) {
        await mutations.deleteNode.mutateAsync({ id: target.id });
      }
    } catch {
      return; // deleteNode's onError already showed a toast.
    }
    selection.clearSelection();
    if (previewNode && roots.some((target) => target.id === previewNode.id)) {
      preview.closePreview();
    }
  }

  if (data.isError) {
    return (
      <main className="p-6">
        <EmptyState
          title="Could not load this data room"
          description={getApiErrorMessage(data.error)}
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
          selection.clearSelection();
          preview.closePreview();
        }
      }}
    >
      <section className="relative flex min-w-0 flex-1 flex-col" {...dropUpload.dropTargetProps}>
        {dropUpload.isDropTarget ? (
          <div className="pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/85">
            <div className="flex flex-col items-center gap-2 text-center">
              <UploadIcon className="size-8 text-primary" aria-hidden />
              <p className="text-sm font-medium">
                Drop PDFs to upload to “{data.currentFolder?.name ?? data.dataroomName}”
              </p>
            </div>
          </div>
        ) : null}
        <RoomHeader
          name={data.currentFolder?.name ?? data.dataroomName}
          kind={data.currentFolder ? 'folder' : 'room'}
          memberCount={data.memberCount}
          isFavorite={favorites.isFavorite(dataroomId)}
          searchTerm={searchTerm}
          activity={data.recentActivity}
          onToggleFavorite={() => favorites.toggle(dataroomId)}
          onOpenMembers={dialogs.openMembers}
          onSearch={onSearchTermChange}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
          {!data.isLoading && !data.folderMissing ? (
            <div className="flex items-center justify-between gap-3">
              <DataroomBreadcrumbs
                dataroomId={dataroomId}
                dataroomName={data.dataroomName}
                path={data.path}
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
            filter={view.filter}
            sortKey={view.sortKey}
            sortDir={view.sortDir}
            view={view.view}
            canEdit={data.canEdit}
            uploading={isUploading}
            onFilter={view.setFilter}
            onSortKey={view.setSortKey}
            onSortDir={view.toggleSortDir}
            onView={view.setView}
            onCreateFolder={dialogs.openCreateFolder}
            onUpload={openFilePicker}
          />

          <input
            ref={inputRef}
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
                {data.isLoading ? (
                  <div className="flex flex-col gap-2" aria-busy>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : data.folderMissing ? (
                  <EmptyState
                    title="Folder not found"
                    description="This folder may have been moved or deleted."
                  />
                ) : view.visibleNodes.length === 0 && !isUploading ? (
                  <BrowserEmptyState
                    isSearchActive={data.isSearchActive}
                    activeSearch={data.activeSearch}
                    filter={view.filter}
                    hasChildren={data.children.length > 0}
                    canEdit={data.canEdit}
                    onClearSearch={() => onSearchTermChange('')}
                    onClearFilter={() => view.setFilter('all')}
                    onUpload={openFilePicker}
                  />
                ) : view.view === 'list' ? (
                  <DocumentTable
                    nodes={view.visibleNodes}
                    uploadingNames={uploadingNames}
                    selectedIds={selection.selectedIds}
                    usersById={data.usersById}
                    memberCount={data.memberCount}
                    canEdit={data.canEdit}
                    selectNodeId={selectNodeId}
                    isFavorite={(id) => favorites.isFavorite(dataroomId, id)}
                    onToggleFavorite={(id) => favorites.toggle(dataroomId, id)}
                    onReveal={preview.revealNode}
                    onToggleSelect={selection.toggleSelect}
                    onSelectRow={preview.openPreview}
                    onOpen={openNode}
                    onToggleAll={selection.toggleAll}
                    onShare={openShare}
                    onRename={dialogs.openRename}
                    onMove={(node) => dialogs.openMove([node])}
                    onDelete={(node) => void trashNodes([node])}
                  />
                ) : (
                  <DocumentGrid
                    nodes={view.visibleNodes}
                    selectedIds={selection.selectedIds}
                    canEdit={data.canEdit}
                    selectNodeId={selectNodeId}
                    isFavorite={(id) => favorites.isFavorite(dataroomId, id)}
                    onToggleFavorite={(id) => favorites.toggle(dataroomId, id)}
                    onReveal={preview.revealNode}
                    onToggleSelect={selection.toggleSelect}
                    onSelectRow={preview.openPreview}
                    onOpen={openNode}
                  />
                )}
              </div>
            </ContextMenuTrigger>
            <BrowserContextMenu
              contextNode={contextNode}
              areaLabel={data.currentFolder?.name ?? data.dataroomName}
              canEdit={data.canEdit}
              hasVisibleNodes={view.visibleNodes.length > 0}
              isFavorite={(id) => favorites.isFavorite(dataroomId, id)}
              onOpenNode={openNode}
              onToggleFavorite={(id) => favorites.toggle(dataroomId, id)}
              onCopyLink={copyLink}
              onShare={openShare}
              onCopyShareLink={copyShareLink}
              onRename={dialogs.openRename}
              onMove={(node) => dialogs.openMove([node])}
              onTrash={(node) => void trashNodes([node])}
              onCreateFolder={dialogs.openCreateFolder}
              onUpload={openFilePicker}
              onSelectAll={selection.selectAll}
              onRefresh={data.refetchNodes}
            />
          </ContextMenu>
        </div>

        {data.canEdit && selection.selectedNodes.length > 0 ? (
          <BulkBar
            count={selection.selectedNodes.length}
            onClear={selection.clearSelection}
            onMove={() => dialogs.openMove(selection.selectedNodes)}
            onDelete={() => void trashNodes(selection.selectedNodes)}
          />
        ) : null}
      </section>

      {previewNode ? (
        <DetailPanel
          dataroomId={dataroomId}
          node={previewNode}
          allNodes={data.nodes}
          usersById={data.usersById}
          memberCount={data.memberCount}
          canEdit={data.canEdit}
          isFavorite={favorites.isFavorite(dataroomId, previewNode.id)}
          onToggleFavorite={() => favorites.toggle(dataroomId, previewNode.id)}
          onClose={preview.closePreview}
          onShare={openShare}
          onRename={dialogs.openRename}
          onMove={dialogs.openMove}
          onDelete={(targets) => void trashNodes(targets)}
          onOpenFile={dialogs.openViewer}
        />
      ) : null}

      <BrowserDialogs
        dataroomId={dataroomId}
        folderId={folderId}
        dialog={dialogs.dialog}
        onClose={dialogs.close}
        nodes={data.nodes}
        siblingNames={siblingNames}
        isOwner={data.isOwner}
        mutations={mutations}
        onMoved={selection.clearSelection}
      />
    </main>
  );
}
