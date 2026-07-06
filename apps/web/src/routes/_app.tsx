import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppSidebar } from '@/features/app-shell';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <AppSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
