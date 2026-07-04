import type { ReactNode } from 'react';

import { cn } from '@repo/ui/lib/utils';

/** Design-system empty state: dashed container with title, hint and optional action. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <span className="text-base font-semibold">{title}</span>
      {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      {action}
    </div>
  );
}
