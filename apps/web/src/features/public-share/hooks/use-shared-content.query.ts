import { useQuery } from '@tanstack/react-query';
import { getSharedFileContent } from '@repo/api-client';
import { useObjectUrl } from '@/shared/hooks/use-object-url';

/**
 * The unlocked shared file's PDF bytes as a stable object URL. Mirrors
 * {@link useNodeContent}, but the public content endpoint is a POST that carries
 * the password in its body (there is no session), so this goes through the
 * generated `getSharedFileContent` caller instead of a GET query hook. For a
 * folder share, `fileId` picks a file inside the shared subtree.
 *
 * The bytes for a (slug, fileId) pair never change, so the query is cached
 * forever — the object URL stays stable and pdf.js does not re-render.
 */
export function useSharedContent(slug: string, password: string | null, fileId?: string) {
  const content = useQuery({
    // Password is deliberately kept out of the cache key (it never changes for
    // one unlocked session, and does not belong in devtools-visible keys).
    queryKey: ['public-share', slug, 'content', fileId ?? null],
    queryFn: () => getSharedFileContent(slug, { password, fileId }),
    staleTime: Infinity,
    retry: false,
  });
  const blob = content.data?.data instanceof Blob ? content.data.data : null;
  const objectUrl = useObjectUrl(blob);
  return {
    objectUrl,
    isPending: content.isPending,
    isError: content.isError,
    error: content.error,
  };
}
