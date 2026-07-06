import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@repo/ui/components/sonner';
import { useUiStore } from '@/shared/store/ui-store';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const isDark = useUiStore((state) => state.theme === 'dark');
  return (
    <>
      <Outlet />
      <Toaster position="top-center" richColors closeButton theme={isDark ? 'dark' : 'light'} />
    </>
  );
}
