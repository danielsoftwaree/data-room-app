import { Button } from '@repo/ui/components/button';
import { MoveIcon, Trash2Icon, XIcon } from 'lucide-react';

/** Floating action bar shown while one or more items are checkbox-selected. */
export function BulkBar({
  count,
  onClear,
  onMove,
  onDelete,
}: Readonly<{ count: number; onClear: () => void; onMove: () => void; onDelete: () => void }>) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex animate-in items-center gap-1 rounded-full border bg-card/95 py-1.5 pr-1.5 pl-4 shadow-lg fade-in slide-in-from-bottom-2 supports-[backdrop-filter]:bg-card/80 supports-[backdrop-filter]:backdrop-blur">
        <span className="text-sm font-medium whitespace-nowrap">{count} selected</span>
        <span className="mx-1.5 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onMove}>
          <MoveIcon className="size-4" />
          Move
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2Icon className="size-4" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
