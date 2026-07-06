import { createFileRoute } from '@tanstack/react-router';
import { TrashScreen } from '@/features/trash';

export const Route = createFileRoute('/_app/trash')({
  component: TrashScreen,
});
