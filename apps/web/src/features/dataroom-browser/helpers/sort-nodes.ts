import type { DataroomNode } from '@repo/domain';
import type { SortDir, SortKey } from '../types';

/** Sort nodes with folders always first, then by the chosen key and direction. */
export function sortVisibleNodes(
  nodes: readonly DataroomNode[],
  sortKey: SortKey,
  dir: SortDir,
): DataroomNode[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    if (sortKey === 'updated') return (a.updatedAt - b.updatedAt) * factor;
    if (sortKey === 'size') {
      const aSize = a.type === 'file' ? a.size : 0;
      const bSize = b.type === 'file' ? b.size : 0;
      return (aSize - bSize) * factor;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * factor;
  });
}
