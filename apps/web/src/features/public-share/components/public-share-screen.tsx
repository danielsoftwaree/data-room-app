import { Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ApiError,
  getApiErrorMessage,
  getSharedFileContent,
  useUnlockShare,
} from '@repo/api-client';
import type { SharedChildDto, SharedNodeDto } from '@repo/contracts';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/ui/components/breadcrumb';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { FilePdfIcon, FolderIcon, VaultIcon } from '@phosphor-icons/react';
import { ArrowLeftIcon, DownloadIcon, LockIcon } from 'lucide-react';
import { formatCount, formatDate, formatFileSize } from '@/shared/lib/format';
import { PdfDocument, PdfPage } from '@/shared/lib/pdf-viewer';
import { useSharedContent } from '../hooks/use-shared-content.query';

interface Unlocked {
  password: string | null;
  node: SharedNodeDto;
}

/**
 * The public, unauthenticated page behind a `/share/:slug` link. On mount it
 * probes the slug without a password: a passwordless share opens immediately,
 * a protected one swaps in the password gate (state stays in the component so
 * the password never touches the URL or storage). Once unlocked, a file share
 * shows the PDF preview card and a folder share a Drive-like browser. A
 * dead/removed link (404) shows an empty state instead.
 */
export function PublicShareScreen({ slug }: Readonly<{ slug: string }>) {
  const [unlocked, setUnlocked] = useState<Unlocked | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const probe = useUnlockShare();
  const { mutate: probeMutate } = probe;

  // The anonymous probe: opens passwordless shares outright, and only a 401
  // (password required) falls through to the gate.
  useEffect(() => {
    probeMutate(
      { slug, data: {} },
      {
        onSuccess: (response) => setUnlocked({ password: null, node: response.data }),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401) setNeedsPassword(true);
        },
      },
    );
  }, [slug, probeMutate]);

  if (unlocked) {
    return unlocked.node.type === 'folder' ? (
      <SharedFolderBrowser slug={slug} password={unlocked.password} node={unlocked.node} />
    ) : (
      <CenteredLayout>
        <SharedFileView
          slug={slug}
          password={unlocked.password}
          name={unlocked.node.name}
          size={unlocked.node.size ?? 0}
        />
      </CenteredLayout>
    );
  }

  return (
    <CenteredLayout>
      {needsPassword ? (
        <UnlockGate slug={slug} onUnlocked={(password, node) => setUnlocked({ password, node })} />
      ) : probe.error instanceof ApiError && probe.error.status === 404 ? (
        <DeadLink />
      ) : probe.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {getApiErrorMessage(probe.error)}
        </p>
      ) : (
        <Skeleton className="h-40 w-full max-w-md rounded-xl" />
      )}
    </CenteredLayout>
  );
}

/** The gate/error/file-share chrome: centered content under the product mark. */
function CenteredLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <ProductMark />
      {children}
    </main>
  );
}

function ProductMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <VaultIcon weight="fill" className="size-5" />
      </span>
      <span className="font-display text-base font-extrabold tracking-tight">Data Room</span>
    </div>
  );
}

function DeadLink() {
  return (
    <div className="w-full max-w-md">
      <EmptyState
        title="This link isn’t available"
        description="The share link is invalid or has been removed by its owner."
      />
    </div>
  );
}

/** Password gate. 404 → dead-link empty state; 401/429 → inline server message. */
function UnlockGate({
  slug,
  onUnlocked,
}: Readonly<{ slug: string; onUnlocked: (password: string, node: SharedNodeDto) => void }>) {
  const unlock = useUnlockShare();
  const [password, setPassword] = useState('');

  // A missing/removed/trashed share is a dead end — swap the form for an empty state.
  if (unlock.error instanceof ApiError && unlock.error.status === 404) {
    return <DeadLink />;
  }

  const inlineError = unlock.isError ? getApiErrorMessage(unlock.error) : null;

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <LockIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">This share is password protected</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the password you were given to view it.
          </p>
        </div>
      </div>

      <form
        className="mt-5 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length === 0 || unlock.isPending) return;
          unlock.mutate(
            { slug, data: { password } },
            { onSuccess: (response) => onUnlocked(password, response.data) },
          );
        }}
      >
        <Label htmlFor="unlock-password" className="sr-only">
          Password
        </Label>
        <Input
          id="unlock-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          placeholder="Password"
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(inlineError)}
        />
        {inlineError ? (
          <p role="alert" className="text-sm text-destructive">
            {inlineError}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={password.length === 0 || unlock.isPending}
        >
          {unlock.isPending ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>
    </div>
  );
}

/**
 * A shared folder as a Drive-like page: top bar, breadcrumbs, a big title and
 * a listing table. Folders navigate in place (the whole live subtree came with
 * the unlock), files open an inline PDF preview; every file row can also be
 * downloaded directly.
 */
function SharedFolderBrowser({
  slug,
  password,
  node,
}: Readonly<{ slug: string; password: string | null; node: SharedNodeDto }>) {
  // The folder trail below the shared root; the open file lives on top of it.
  const [stack, setStack] = useState<SharedChildDto[]>([]);
  const [openFile, setOpenFile] = useState<SharedChildDto | null>(null);
  const current = stack.length > 0 ? stack[stack.length - 1] : null;
  const children = (current ? current.children : node.children) ?? [];

  /** Jump to a breadcrumb: depth 0 is the shared root. */
  function navigateTo(depth: number): void {
    setOpenFile(null);
    setStack((previous) => previous.slice(0, depth));
  }

  const crumbs = [node.name, ...stack.map((folder) => folder.name)];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
        <ProductMark />
        <span className="text-xs text-muted-foreground">View-only shared folder</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {crumbs.length > 1 || openFile ? (
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              {crumbs.map((name, depth) => {
                const isCurrent = !openFile && depth === crumbs.length - 1;
                return (
                  <Fragment key={`${depth}-${name}`}>
                    {depth > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {isCurrent ? (
                        <BreadcrumbPage className="max-w-48 truncate">{name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            className="max-w-48 truncate"
                            onClick={() => navigateTo(depth)}
                          >
                            {name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
              {openFile ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-48 truncate">{openFile.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}

        {openFile ? (
          <SharedFileView
            slug={slug}
            password={password}
            name={openFile.name}
            size={openFile.size ?? 0}
            fileId={openFile.id}
            onBack={() => setOpenFile(null)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="truncate font-display text-2xl font-bold tracking-tight">
                {(current ?? node).name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formatCount(children.length, 'item')}
              </p>
            </div>
            <div className="mt-4">
              {children.length === 0 ? (
                <EmptyState
                  title="This folder is empty"
                  description="Nothing has been added here yet."
                />
              ) : (
                <SharedFolderTable
                  slug={slug}
                  password={password}
                  items={children}
                  onOpenFolder={(folder) => setStack((previous) => [...previous, folder])}
                  onOpenFile={setOpenFile}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** The listing table: Name | Modified | Size, plus a hover download for files. */
function SharedFolderTable({
  slug,
  password,
  items,
  onOpenFolder,
  onOpenFile,
}: Readonly<{
  slug: string;
  password: string | null;
  items: SharedChildDto[];
  onOpenFolder: (folder: SharedChildDto) => void;
  onOpenFile: (file: SharedChildDto) => void;
}>) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function download(file: SharedChildDto): Promise<void> {
    setDownloadingId(file.id);
    try {
      const response = await getSharedFileContent(slug, { password, fileId: file.id });
      const data = response.data;
      const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_92px_36px] items-center gap-3 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_140px_100px_36px]">
        <span>Name</span>
        <span className="hidden sm:block">Modified</span>
        <span>Size</span>
        <span />
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className="group grid grid-cols-[minmax(0,1fr)_92px_36px] items-center gap-3 border-b px-4 py-1.5 text-sm transition-colors last:border-b-0 hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_140px_100px_36px]"
          >
            <button
              type="button"
              onClick={() => (item.type === 'folder' ? onOpenFolder(item) : onOpenFile(item))}
              className="flex min-w-0 items-center gap-2.5 py-1.5 text-left outline-none focus-visible:underline"
            >
              {item.type === 'folder' ? (
                <FolderIcon weight="fill" className="size-5 shrink-0 text-primary" />
              ) : (
                <FilePdfIcon weight="fill" className="size-5 shrink-0 text-destructive" />
              )}
              <span className="truncate font-medium">{item.name}</span>
            </button>
            <span className="hidden text-muted-foreground sm:block">
              {formatDate(item.updatedAt)}
            </span>
            <span className="text-muted-foreground">
              {item.type === 'file' ? formatFileSize(item.size ?? 0) : '—'}
            </span>
            <span className="flex justify-end">
              {item.type === 'file' ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${item.name}`}
                  disabled={downloadingId === item.id}
                  className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  onClick={() => void download(item)}
                >
                  <DownloadIcon className="size-4" />
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A shared file: header + download, and an inline continuous-scroll PDF preview. */
function SharedFileView({
  slug,
  password,
  name,
  size,
  fileId,
  onBack,
}: Readonly<{
  slug: string;
  password: string | null;
  name: string;
  size: number;
  /** Set when the file lives inside a shared folder. */
  fileId?: string;
  onBack?: () => void;
}>) {
  const content = useSharedContent(slug, password, fileId);
  const [pageCount, setPageCount] = useState(0);

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b p-4">
        {onBack ? (
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeftIcon className="size-4" />
          </Button>
        ) : null}
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
          <FilePdfIcon weight="fill" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{name}</h1>
          <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
        </div>
        {content.objectUrl ? (
          <Button asChild>
            <a href={content.objectUrl} download={name}>
              <DownloadIcon className="size-4" />
              Download
            </a>
          </Button>
        ) : (
          <Button disabled>
            <DownloadIcon className="size-4" />
            Download
          </Button>
        )}
      </header>

      <div className="max-h-[72vh] overflow-auto bg-muted/40 p-4">
        {content.isPending ? (
          <Skeleton className="mx-auto h-[70vh] w-full max-w-[680px]" />
        ) : content.isError || !content.objectUrl ? (
          <p role="alert" className="p-6 text-center text-sm text-destructive">
            {content.isError ? getApiErrorMessage(content.error) : 'Couldn’t display this PDF.'}
          </p>
        ) : (
          <PdfDocument
            file={content.objectUrl}
            onLoadSuccess={(document) => setPageCount(document.numPages)}
            loading={<Skeleton className="mx-auto h-[70vh] w-full max-w-[680px]" />}
            error={
              <p role="alert" className="p-6 text-center text-sm text-destructive">
                Couldn’t display this PDF.
              </p>
            }
            className="mx-auto flex w-fit flex-col gap-4"
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <PdfPage
                key={index + 1}
                pageNumber={index + 1}
                width={680}
                renderAnnotationLayer={false}
                className="border shadow-sm"
              />
            ))}
          </PdfDocument>
        )}
      </div>
    </div>
  );
}
