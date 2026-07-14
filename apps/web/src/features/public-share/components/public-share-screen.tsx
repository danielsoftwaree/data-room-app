import { useEffect, useState } from 'react';
import { ApiError, getApiErrorMessage, useUnlockShare } from '@repo/api-client';
import type { SharedChildDto, SharedNodeDto } from '@repo/contracts';
import { Button } from '@repo/ui/components/button';
import { EmptyState } from '@repo/ui/components/empty-state';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Skeleton } from '@repo/ui/components/skeleton';
import { FilePdfIcon, FolderIcon, VaultIcon } from '@phosphor-icons/react';
import { ArrowLeftIcon, DownloadIcon, LockIcon } from 'lucide-react';
import { formatFileSize } from '@/shared/lib/format';
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
 * shows the PDF preview and a folder share a browsable listing. A dead/removed
 * link (404) shows an empty state instead.
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <ProductMark />
      {unlocked ? (
        <UnlockedView slug={slug} password={unlocked.password} node={unlocked.node} />
      ) : needsPassword ? (
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

function UnlockedView({
  slug,
  password,
  node,
}: Readonly<{ slug: string; password: string | null; node: SharedNodeDto }>) {
  if (node.type === 'file') {
    return (
      <SharedFileView slug={slug} password={password} name={node.name} size={node.size ?? 0} />
    );
  }
  return <SharedFolderView slug={slug} password={password} node={node} />;
}

/**
 * A shared folder: its live subtree as a nested listing. Opening a file swaps
 * the listing for the file preview with a back button.
 */
function SharedFolderView({
  slug,
  password,
  node,
}: Readonly<{ slug: string; password: string | null; node: SharedNodeDto }>) {
  const [openFile, setOpenFile] = useState<SharedChildDto | null>(null);
  const children = node.children ?? [];

  if (openFile) {
    return (
      <SharedFileView
        slug={slug}
        password={password}
        name={openFile.name}
        size={openFile.size ?? 0}
        fileId={openFile.id}
        onBack={() => setOpenFile(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <FolderIcon weight="fill" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{node.name}</h1>
          <p className="text-xs text-muted-foreground">Shared folder</p>
        </div>
      </header>
      <div className="max-h-[72vh] overflow-auto p-2">
        {children.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">This folder is empty.</p>
        ) : (
          <SharedChildList items={children} depth={0} onOpenFile={setOpenFile} />
        )}
      </div>
    </div>
  );
}

function SharedChildList({
  items,
  depth,
  onOpenFile,
}: Readonly<{
  items: SharedChildDto[];
  depth: number;
  onOpenFile: (file: SharedChildDto) => void;
}>) {
  return (
    <ul className="grid gap-0.5">
      {items.map((item) => (
        <li key={item.id}>
          {item.type === 'folder' ? (
            <>
              <div
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
              >
                <FolderIcon weight="fill" className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{item.name}</span>
              </div>
              {item.children && item.children.length > 0 ? (
                <SharedChildList items={item.children} depth={depth + 1} onOpenFile={onOpenFile} />
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenFile(item)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
              <FilePdfIcon weight="fill" className="size-4 shrink-0 text-destructive" />
              <span className="truncate">{item.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatFileSize(item.size ?? 0)}
              </span>
            </button>
          )}
        </li>
      ))}
    </ul>
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
