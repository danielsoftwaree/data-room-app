/**
 * Public entry of the favorites feature: the Favorites screen plus the
 * favoriting building blocks (star/unstar hook, link-to-favorite) that other
 * features and the app shell reuse.
 */
export { FavoritesScreen } from './components/favorites-screen';
export { FavoriteLink } from './components/favorite-link';
export { useFavorites } from './hooks/use-favorites';
export { favoriteKey } from './helpers/favorite-key';
