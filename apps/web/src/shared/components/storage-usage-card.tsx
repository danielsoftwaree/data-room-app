import { useGetStorageUsage } from '@repo/api-client';
import { Progress } from '@repo/ui/components/progress';
import { Skeleton } from '@repo/ui/components/skeleton';
import { HardDriveIcon } from 'lucide-react';
import { formatFileSize } from '@/shared/lib/format';

/**
 * Self-contained "Storage" usage card (sidebar + dashboard). Owns its query —
 * TanStack Query dedupes concurrent mounts — so callers only style the shell
 * via `className`.
 */
export function StorageUsageCard({ className }: Readonly<{ className?: string }>) {
  const storage = useGetStorageUsage();
  const usage = storage.data?.data;
  const percent = usage ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100)) : 0;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <HardDriveIcon className="size-4 text-muted-foreground" />
        Storage
      </div>
      {usage ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {formatFileSize(usage.usedBytes)} of {formatFileSize(usage.quotaBytes)} used
        </p>
      ) : (
        <Skeleton className="mb-2 h-4 w-28" />
      )}
      <Progress value={percent} />
    </div>
  );
}
