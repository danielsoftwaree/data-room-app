import { createFileRoute, redirect } from '@tanstack/react-router';
import { DesignSystemScreen } from '@/features/design-system';

export const Route = createFileRoute('/design-system')({
  // Dev-only component showcase: redirect away in production so no demo
  // buttons without real handlers are ever reachable there.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: '/' });
  },
  component: DesignSystemScreen,
});
