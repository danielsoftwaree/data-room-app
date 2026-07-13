import { useGetNodeContent } from '@repo/api-client';
import { useObjectUrl } from '@/shared/hooks/use-object-url';

/**
 * A file node's PDF bytes as a stable object URL. Content for a node id never
 * changes (renames don't touch bytes), so the query is cached forever:
 * without this, mounting a second consumer (opening the full viewer from the
 * detail-panel thumbnail) or refocusing the window refetches the blob, its
 * identity changes, and pdf.js tears down and re-renders — the thumbnail
 * visibly blinks and jumps in height.
 */
export function useNodeContent(fileId: string) {
  const content = useGetNodeContent(fileId, { query: { staleTime: Infinity } });
  const blob = content.data?.data instanceof Blob ? content.data.data : null;
  const objectUrl = useObjectUrl(blob);
  return {
    objectUrl,
    isPending: content.isPending,
    isError: content.isError,
    error: content.error,
  };
}
