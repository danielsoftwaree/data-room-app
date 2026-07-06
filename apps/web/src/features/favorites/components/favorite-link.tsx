import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { FavoriteDto } from '@repo/api-client';

interface FavoriteLinkProps {
  favorite: FavoriteDto;
  className?: string;
  /** Fired on click so e.g. the mobile drawer can close itself. */
  onNavigate?: () => void;
  children: ReactNode;
}

/**
 * Navigates to a favorite's target (used by the sidebar and the Favorites
 * screen). Folders open directly; a favorited file opens its containing folder
 * (or the room root) with `?select=<id>`, so it is scrolled to and highlighted
 * on arrival; `nodeId === null` opens the room itself.
 */
export function FavoriteLink({
  favorite,
  className,
  onNavigate,
  children,
}: Readonly<FavoriteLinkProps>) {
  if (favorite.nodeType === 'folder' && favorite.nodeId) {
    return (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.nodeId }}
        onClick={onNavigate}
        className={className}
      >
        {children}
      </Link>
    );
  }
  if (favorite.nodeType === 'file' && favorite.nodeId) {
    const search = { select: favorite.nodeId };
    return favorite.parentId ? (
      <Link
        to="/datarooms/$dataroomId/folders/$folderId"
        params={{ dataroomId: favorite.dataroomId, folderId: favorite.parentId }}
        search={search}
        onClick={onNavigate}
        className={className}
      >
        {children}
      </Link>
    ) : (
      <Link
        to="/datarooms/$dataroomId"
        params={{ dataroomId: favorite.dataroomId }}
        search={search}
        onClick={onNavigate}
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/datarooms/$dataroomId"
      params={{ dataroomId: favorite.dataroomId }}
      onClick={onNavigate}
      className={className}
    >
      {children}
    </Link>
  );
}
