import { useCallback, useRef, useState } from 'react';
import { getApiErrorMessage } from '@repo/api-client';
import type { FileNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { Input } from '@repo/ui/components/input';
import { Skeleton } from '@repo/ui/components/skeleton';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { PdfDocument, PdfPage } from '@/shared/lib/pdf-viewer';
import { useNodeContent } from '../hooks/use-node-content.query';

/**
 * Modal PDF viewer rendered with react-pdf (pdf.js): every page in a
 * continuous scroll, page navigation, zoom controls, selectable text and
 * in-document text search with highlighted matches.
 *
 * The PDF is fetched as a Blob via the generated client (a regular fetch) and
 * fed to pdf.js through an object URL, instead of pointing pdf.js at the API
 * route directly. Reason: this keeps loading/error states in our hands and,
 * in dev, the request goes through MSW like every other API call.
 */
export function PdfViewerDialog({ file, onClose }: { file: FileNode | null; onClose: () => void }) {
  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[85vh] w-[min(92vw,960px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="truncate pr-6 text-left">{file?.name}</DialogTitle>
        </DialogHeader>
        {file ? <PdfContent key={file.id} file={file} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const BASE_PAGE_WIDTH = 800;

/** pdf.js document proxy — only the bits we call. */
interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  }>;
}

interface SearchState {
  query: string;
  /** Page numbers (1-based) containing at least one match, ascending. */
  pages: number[];
  /** Index into `pages` of the currently focused match. */
  current: number;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function PdfContent({ file }: { file: FileNode }) {
  const content = useNodeContent(file.id);
  const objectUrl = content.objectUrl;
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2); // 100%
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<SearchState | null>(null);
  const pdfRef = useRef<PdfDocumentProxy | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const zoom = ZOOM_LEVELS[zoomIndex];

  const scrollToPage = useCallback((pageNumber: number) => {
    pageRefs.current[pageNumber - 1]?.scrollIntoView({ block: 'start' });
    setCurrentPage(pageNumber);
  }, []);

  // Track which page is at the top of the viewport while scrolling.
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let visible = 1;
    for (let index = 0; index < pageRefs.current.length; index++) {
      const page = pageRefs.current[index];
      if (!page) continue;
      if (page.getBoundingClientRect().top - containerTop <= container.clientHeight / 2) {
        visible = index + 1;
      } else {
        break;
      }
    }
    setCurrentPage(visible);
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      const pdf = pdfRef.current;
      const trimmed = query.trim();
      if (!pdf || trimmed === '') {
        setSearch(null);
        return;
      }
      const needle = trimmed.toLowerCase();
      const pages: number[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const text = await page.getTextContent();
        const pageText = text.items.map((item) => item.str ?? '').join(' ');
        if (pageText.toLowerCase().includes(needle)) pages.push(pageNumber);
      }
      setSearch({ query: trimmed, pages, current: 0 });
      if (pages.length > 0) scrollToPage(pages[0]);
    },
    [scrollToPage],
  );

  const stepMatch = useCallback(
    (delta: number) => {
      setSearch((previous) => {
        if (!previous || previous.pages.length === 0) return previous;
        const next =
          (previous.current + delta + previous.pages.length) % previous.pages.length;
        scrollToPage(previous.pages[next]);
        return { ...previous, current: next };
      });
    },
    [scrollToPage],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchInput('');
    setSearch(null);
  }, []);

  // Wrap matched substrings in <mark> inside the pdf.js text layer.
  // ponytail: matches spanning two text items aren't highlighted; good enough
  // for page-level search — a full pdf.js findController if it ever matters.
  const highlight = useCallback(
    (textItem: { str: string }) => {
      if (!search || search.query === '') return textItem.str;
      const pattern = new RegExp(`(${escapeRegExp(search.query)})`, 'gi');
      return textItem.str.replace(pattern, '<mark>$1</mark>');
    },
    [search],
  );

  if (content.isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="min-h-0 w-full flex-1" />
      </div>
    );
  }

  if (content.isError || !objectUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p role="alert" className="text-sm text-destructive">
          {content.isError ? getApiErrorMessage(content.error) : 'Couldn’t display this PDF.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={pageCount === 0 || currentPage <= 1}
            onClick={() => scrollToPage(currentPage - 1)}
          >
            <ChevronUpIcon className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {pageCount > 0 ? `${currentPage} / ${pageCount}` : 'Loading…'}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={pageCount === 0 || currentPage >= pageCount}
            onClick={() => scrollToPage(currentPage + 1)}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {searchOpen ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (search && search.query === searchInput.trim()) {
                  stepMatch(1);
                } else {
                  void runSearch(searchInput);
                }
              }}
            >
              <Input
                autoFocus
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeSearch();
                }}
                placeholder="Find in document…"
                className="h-7 w-44 text-xs"
                aria-label="Find in document"
              />
              {search ? (
                <span
                  className="whitespace-nowrap text-xs text-muted-foreground tabular-nums"
                  role="status"
                >
                  {search.pages.length > 0
                    ? `${search.current + 1} / ${search.pages.length}`
                    : 'No matches'}
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Previous match"
                disabled={!search || search.pages.length === 0}
                onClick={() => stepMatch(-1)}
              >
                <ChevronUpIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next match"
                disabled={!search || search.pages.length === 0}
                onClick={() => stepMatch(1)}
              >
                <ChevronDownIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close search"
                onClick={closeSearch}
              >
                <XIcon className="size-4" />
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Find in document"
              disabled={pageCount === 0}
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
          >
            <MinusIcon className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto bg-muted/40 p-4"
      >
        <PdfDocument
          file={objectUrl}
          onLoadSuccess={(document) => {
            pdfRef.current = document as unknown as PdfDocumentProxy;
            setPageCount(document.numPages);
          }}
          loading={<Skeleton className="mx-auto h-[70vh] w-full max-w-[800px]" />}
          error={
            <p role="alert" className="text-sm text-destructive">
              Couldn’t display this PDF.
            </p>
          }
          className="mx-auto flex w-fit flex-col gap-4"
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <div
              key={index + 1}
              ref={(element) => {
                pageRefs.current[index] = element;
              }}
            >
              <PdfPage
                pageNumber={index + 1}
                width={Math.round(BASE_PAGE_WIDTH * zoom)}
                renderAnnotationLayer={false}
                customTextRenderer={highlight}
                className="border shadow-sm"
              />
            </div>
          ))}
        </PdfDocument>
      </div>
    </>
  );
}
