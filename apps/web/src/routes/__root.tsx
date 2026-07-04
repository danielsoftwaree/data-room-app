import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@repo/ui/components/sonner';
import { useDarkTheme } from '../shared/theme';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const isDark = useDarkTheme();
  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" richColors closeButton theme={isDark ? 'dark' : 'light'} />
    </>
  );
}
