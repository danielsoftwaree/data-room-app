import type { DataroomNode } from '@repo/domain';
import type { FilterMode } from '../types';

/** Narrow a node list to folders, files, or everything. */
export function filterNodes(nodes: readonly DataroomNode[], filter: FilterMode): DataroomNode[] {
  if (filter === 'folders') return nodes.filter((node) => node.type === 'folder');
  if (filter === 'files') return nodes.filter((node) => node.type === 'file');
  return [...nodes];
}
