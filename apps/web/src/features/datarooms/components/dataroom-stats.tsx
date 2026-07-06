import { useGetStorageUsage, useListFavorites } from '@repo/api-client';
import { LayoutGridIcon, HardDriveIcon, StarIcon } from 'lucide-react';
import { formatFileSize } from '@/shared/lib/format';

/** The dashboard's headline numbers: room count, storage used, favorites. */
export function DataroomStats({ roomCount }: Readonly<{ roomCount: number }>) {
  const storage = useGetStorageUsage();
  const favorites = useListFavorites();
  const usage = storage.data?.data;
  const favoriteCount = favorites.data?.data.length ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatTile
        icon={LayoutGridIcon}
        value={roomCount}
        label={roomCount === 1 ? 'Data room' : 'Data rooms'}
      />
      <StatTile
        icon={HardDriveIcon}
        value={usage ? formatFileSize(usage.usedBytes) : '—'}
        label={usage ? `of ${formatFileSize(usage.quotaBytes)} used` : 'Storage'}
      />
      <StatTile
        icon={StarIcon}
        value={favoriteCount}
        label={favoriteCount === 1 ? 'Favorite' : 'Favorites'}
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: Readonly<{ icon: typeof LayoutGridIcon; value: string | number; label: string }>) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
