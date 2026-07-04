import { getApiErrorMessage, useGetNodeContent } from '@repo/api-client';
import type { FileNode } from '@repo/domain';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/components/dialog';
import { Skeleton } from '@repo/ui/components/skeleton';
import { useObjectUrl } from '../../../shared/use-object-url';

/**
 * Modal PDF preview.
 *
 * The PDF is fetched as a Blob via the generated client (a regular fetch) and
 * shown through an object URL, instead of pointing the iframe `src` at the API
 * route directly. Reason: iframe loads are *navigation* requests, which
 * service workers (MSW in dev) do not intercept - a direct src would bypass
 * the mock API and 502 against the dev proxy. Fetching also gives us proper
 * loading/error states, and works identically against the real backend.
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

function PdfContent({ file }: { file: FileNode }) {
  const content = useGetNodeContent(file.id);
  const blob = content.data?.data instanceof Blob ? content.data.data : null;

  const objectUrl = useObjectUrl(blob);

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

  return <iframe title={file.name} src={objectUrl} className="min-h-0 w-full flex-1" />;
}
