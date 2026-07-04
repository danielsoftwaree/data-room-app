import { useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getApiErrorMessage, useGetDataroom, useListNodes } from '@repo/api-client';
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
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Input } from '@repo/ui/components/input';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { ArrowLeftIcon, FolderPlusIcon, SearchIcon, UploadIcon, XIcon } from 'lucide-react';
import { NameDialog } from '../../../shared/NameDialog';
import { childrenOf, findNode, folderPath, subtreeCounts } from '../../../shared/node-tree';
import { toDataroomNode } from '../../../shared/api-adapters';
import { useNodeMutations } from '../hooks';
import { DataroomBreadcrumbs } from './Breadcrumbs';
import { NodeRow } from './NodeRow';
import { PdfViewerDialog } from './PdfViewerDialog';
import { SearchResults } from './SearchResults';

interface DataroomBrowserScreenProps {
  dataroomId: string;
  folderId: string | null;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

export function DataroomBrowserScreen({
  dataroomId,
  folderId,
  searchTerm,
  onSearchTermChange,
}: Readonly<DataroomBrowserScreenProps>) {
  const dataroom = useGetDataroom(dataroomId);
  const activeSearch = searchTerm.trim();
  const isSearchActive = activeSearch.length > 0;
  const nodesQuery = useListNodes(dataroomId);
  const searchNodesQuery = useListNodes(
    dataroomId,
    isSearchActive ? { search: activeSearch } : undefined,
    { query: { enabled: isSearchActive } },
  );
  const nodes = useMemo(() => (nodesQuery.data?.data ?? []).map(toDataroomNode), [nodesQuery.data]);
  const searchResults = useMemo(
    () => (searchNodesQuery.data?.data ?? []).map(toDataroomNode),
    [searchNodesQuery.data],
  );

  const currentFolder = folderId !== null ? findNode(nodes, folderId) : undefined;
  const folderMissing = folderId !== null && nodesQuery.isSuccess && !currentFolder;

  const children = useMemo(() => childrenOf(nodes, folderId), [nodes, folderId]);
  const path = useMemo(() => folderPath(nodes, folderId), [nodes, folderId]);
  const siblingNames = useMemo(() => children.map((node) => node.name), [children]);

  const { createFolder, createFile, renameNode, deleteNode } = useNodeMutations(dataroomId);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DataroomNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataroomNode | null>(null);
  const [viewerFile, setViewerFile] = useState<FileNode | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dataroomName = dataroom.data?.data.name ?? 'Data room';

  function scheduleSearch(nextTerm: string): void {
    if (searchDebounceRef.current !== null) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onSearchTermChange(nextTerm.trim());
    }, 250);
  }

  function clearSearch(): void {
    if (searchDebounceRef.current !== null) clearTimeout(searchDebounceRef.current);
    if (searchInputRef.current) searchInputRef.current.value = '';
    onSearchTermChange('');
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const accepted = files.filter((file) =>
      UPLOAD.acceptedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext)),
    );
    const skipped = files.length - accepted.length;
    if (skipped > 0) toast.error(`${skipped} file(s) skipped — only PDF files are allowed`);
    if (accepted.length === 0) return;

    setIsUploading(true);
    let succeeded = 0;
    const failures: string[] = [];
    for (const file of accepted) {
      try {
        await createFile.mutateAsync({ id: dataroomId, data: { parentId: folderId, file } });
        succeeded += 1;
      } catch (error) {
        failures.push(`${file.name}: ${getApiErrorMessage(error)}`);
      }
    }
    setIsUploading(false);

    if (succeeded > 0) toast.success(`${succeeded} file(s) uploaded`);
    if (failures.length > 0) {
      toast.error(`${failures.length} upload(s) failed`, { description: failures[0] });
    }
  }

  const deleteCounts =
    deleteTarget && deleteTarget.type === 'folder' ? subtreeCounts(nodes, deleteTarget.id) : null;

  const isLoading = dataroom.isPending || nodesQuery.isPending;
  const isError =
    dataroom.isError || nodesQuery.isError || (isSearchActive && searchNodesQuery.isError);
  const browserError =
    dataroom.error ?? nodesQuery.error ?? (isSearchActive ? searchNodesQuery.error : null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeftIcon className="size-4" />
            All data rooms
          </Link>
        </Button>
        {!isError ? (
          <DataroomBreadcrumbs dataroomId={dataroomId} dataroomName={dataroomName} path={path} />
        ) : null}
      </div>

      {isError ? (
        <EmptyState
          title="Couldn’t load this data room"
          description={getApiErrorMessage(browserError)}
          action={
            <Button variant="outline" asChild>
              <Link to="/">Back to data rooms</Link>
            </Button>
          }
        />
      ) : folderMissing ? (
        <EmptyState
          title="Folder not found"
          description="This folder may have been moved or deleted."
          action={
            <Button variant="outline" asChild>
              <Link to="/datarooms/$dataroomId" params={{ dataroomId }}>
                Go to data room root
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {currentFolder ? currentFolder.name : dataroomName}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  createFolder.reset();
                  setCreateFolderOpen(true);
                }}
              >
                <FolderPlusIcon className="size-4" />
                New folder
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                <UploadIcon className="size-4" />
                {isUploading ? 'Uploading…' : 'Upload PDF'}
              </Button>
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
            </div>
          </div>

          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              key={searchTerm}
              ref={searchInputRef}
              type="search"
              defaultValue={searchTerm}
              placeholder="Search files and folders"
              className="h-10 pr-10 pl-9"
              onChange={(event) => scheduleSearch(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') clearSearch();
              }}
            />
            {isSearchActive ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                onClick={clearSearch}
                className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
              >
                <XIcon className="size-4" />
              </Button>
            ) : null}
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!isDragging) setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (event.dataTransfer.files.length > 0) void uploadFiles(event.dataTransfer.files);
            }}
            className={
              isDragging ? 'rounded-xl outline-2 outline-offset-4 outline-primary' : undefined
            }
          >
            {isLoading ? (
              <ul className="flex flex-col gap-2" aria-busy>
                <Skeleton className="h-[68px] w-full" />
                <Skeleton className="h-[68px] w-full" />
                <Skeleton className="h-[68px] w-full" />
              </ul>
            ) : isSearchActive ? (
              <SearchResults
                dataroomId={dataroomId}
                dataroomName={dataroomName}
                query={activeSearch}
                results={searchResults}
                allNodes={nodes}
                isLoading={searchNodesQuery.isPending}
                onOpenFile={setViewerFile}
                onClearSearch={clearSearch}
              />
            ) : children.length === 0 ? (
              <EmptyState
                title="This folder is empty"
                description="Create a subfolder or upload PDF files. You can also drag & drop PDFs here."
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        createFolder.reset();
                        setCreateFolderOpen(true);
                      }}
                    >
                      <FolderPlusIcon className="size-4" />
                      New folder
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      <UploadIcon className="size-4" />
                      Upload PDF
                    </Button>
                  </div>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {children.map((node) => (
                  <NodeRow
                    key={node.id}
                    dataroomId={dataroomId}
                    node={node}
                    onOpenFile={setViewerFile}
                    onRename={(target) => {
                      renameNode.reset();
                      setRenameTarget(target);
                    }}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Create folder */}
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

      {/* Rename node */}
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

      {/* Delete node (with cascade count for folders) */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'folder'
                ? deleteCounts && deleteCounts.folders + deleteCounts.files > 0
                  ? `This permanently deletes the folder and its contents (${deleteCounts.folders} folder(s) and ${deleteCounts.files} file(s)). This cannot be undone.`
                  : 'This permanently deletes the folder. This cannot be undone.'
                : 'This permanently deletes the file. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget) return;
                deleteNode.mutate(
                  { id: deleteTarget.id },
                  { onSuccess: () => setDeleteTarget(null) },
                );
              }}
            >
              {deleteNode.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PdfViewerDialog file={viewerFile} onClose={() => setViewerFile(null)} />
    </main>
  );
}
