import { useEffect, useMemo } from 'react';

export function useObjectUrl(blob: Blob | null): string | null {
  const objectUrl = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(
      blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }),
    );
  }, [blob]);

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  return objectUrl;
}
