import { createFileRoute } from '@tanstack/react-router';
import { FavoritesScreen } from '../features/favorites';

export const Route = createFileRoute('/_app/favorites')({
  component: FavoritesScreen,
});
