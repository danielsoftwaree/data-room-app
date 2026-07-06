import { MobileTopBar } from './mobile-top-bar';
import { SidebarBody } from './sidebar-body';

/**
 * App navigation. Renders as a fixed rail on desktop (lg+) and as a hamburger
 * that opens an off-canvas drawer on mobile; both share {@link SidebarBody}.
 */
export function AppSidebar() {
  return (
    <>
      <MobileTopBar />
      <aside className="sticky top-0 z-20 hidden h-screen w-[248px] shrink-0 flex-col border-r bg-card lg:flex">
        <SidebarBody />
      </aside>
    </>
  );
}
