import type { UserDto } from '@repo/api-client';
import { cn } from '@repo/ui/lib/utils';

/** Maps a demo user's brand color to a Tailwind background, with a readable ink. */
const COLOR_CLASS: Record<string, string> = {
  '#5865f2': 'bg-primary',
  '#35ed7e': 'bg-emerald-400 text-foreground',
  '#a78bfa': 'bg-violet-400',
  '#f6c956': 'bg-yellow-400 text-foreground',
  '#ec48bd': 'bg-pink-500',
  '#00b0f4': 'bg-sky-500',
};

/** A colored initials avatar shared by the sidebar, dashboard, members, and trash. */
export function UserAvatar({
  user,
  className,
}: Readonly<{ user: Pick<UserDto, 'name' | 'color'> | undefined; className?: string }>) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold text-white',
        COLOR_CLASS[user?.color ?? ''] ?? 'bg-primary',
        className ?? 'size-8 text-xs',
      )}
      aria-hidden
    >
      {initials(user?.name ?? '?')}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
