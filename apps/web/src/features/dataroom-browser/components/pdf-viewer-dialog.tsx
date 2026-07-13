import { useState } from 'react';
import { getApiErrorMessage } from '@repo/api-client';
import type { FileNode } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { Skeleton } from '@repo/ui/components/skeleton';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { formatCount } from '@/shared/lib/format';
import { PdfDocument, PdfPage } from '@/shared/lib/pdf-viewer';
import { useNodeContent } from '../hooks/use-node-content.query';

/**
 * Modal PDF viewer rendered with react-pdf (pdf.js): every page, zoom
 * controls, selectable text.
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

function PdfContent({ file }: { file: FileNode }) {
  const content = useNodeContent(file.id);
  const objectUrl = content.objectUrl;
  const [pageCount, setPageCount] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(2); // 100%
  const zoom = ZOOM_LEVELS[zoomIndex];

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
        <span className="text-xs text-muted-foreground">
          {pageCount > 0 ? formatCount(pageCount, 'page') : 'Loading…'}
        </span>
        <div className="flex items-center gap-1">
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
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-4">
        <PdfDocument
          file={objectUrl}
          onLoadSuccess={(document) => setPageCount(document.numPages)}
          loading={<Skeleton className="mx-auto h-[70vh] w-full max-w-[800px]" />}
          error={
            <p role="alert" className="text-sm text-destructive">
              Couldn’t display this PDF.
            </p>
          }
          className="mx-auto flex w-fit flex-col gap-4"
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <PdfPage
              key={index + 1}
              pageNumber={index + 1}
              width={Math.round(BASE_PAGE_WIDTH * zoom)}
              renderAnnotationLayer={false}
              className="border shadow-sm"
            />
          ))}
        </PdfDocument>
      </div>
    </>
  );
}
