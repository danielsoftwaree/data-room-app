import { createFileRoute } from '@tanstack/react-router';
import { DataroomsScreen } from '@/features/datarooms';

export const Route = createFileRoute('/_app/')({
  component: DataroomsScreen,
});
