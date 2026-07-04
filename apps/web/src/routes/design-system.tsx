import { createFileRoute } from '@tanstack/react-router';
import { DesignSystemScreen } from '../features/design-system';

export const Route = createFileRoute('/design-system')({
  component: DesignSystemScreen,
});
