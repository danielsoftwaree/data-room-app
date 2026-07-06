import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Button } from '@repo/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@repo/ui/components/sheet';
import { VaultIcon } from '@phosphor-icons/react';
import { MenuIcon } from 'lucide-react';
import { UserMenu } from '@/shared/components/user-menu';
import { SidebarBody } from './sidebar-body';

/** Mobile (<lg) top bar: hamburger drawer with the sidebar content + logo + account. */
export function MobileTopBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 lg:hidden">
      {/* Keyed by pathname: any route change (favorite links, back/forward, …)
          remounts the drawer closed — no close-on-navigate effect needed. */}
      <MobileNavDrawer key={pathname} />

      <Link to="/" className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <VaultIcon weight="fill" className="size-4" />
        </span>
        <span className="font-display text-base font-extrabold tracking-tight">Data Room</span>
      </Link>

      <div className="ml-auto">
        <UserMenu compact />
      </div>
    </header>
  );
}

function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Data rooms, favorites, trash and account
        </SheetDescription>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
