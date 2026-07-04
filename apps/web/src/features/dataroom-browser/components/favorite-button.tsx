import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import { StarIcon } from 'lucide-react';

/** Star toggle: always visible when starred, hover/focus-revealed otherwise. */
export function FavoriteButton({
  favorite,
  onToggle,
}: Readonly<{ favorite: boolean; onToggle: () => void }>) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorite}
      className={cn(
        'transition-opacity',
        favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <StarIcon
        className={cn('size-4', favorite ? 'fill-primary text-primary' : 'text-muted-foreground')}
      />
    </Button>
  );
}
