import { createRouter, RouterProvider } from '@tanstack/react-router';

import { routeTree } from '@/routeTree.gen';

/**
 * App shell. Route-to-feature wiring is file-based under src/routes/*
 * (TanStack Router); the generated routeTree is mounted here. Features
 * themselves stay self-contained under src/features/*.
 */
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
