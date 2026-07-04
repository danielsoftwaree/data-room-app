import type { DataroomNode } from '@repo/domain';

/**
 * Client-side helpers over the flat, server-sorted node list of a single
 * dataroom. The API returns nodes already ordered (folders first, then name),
 * so these helpers only slice/walk that list - they never re-sort.
 */

/** Direct children of a folder (parentId === folderId; null = dataroom root). */
export function childrenOf(
  nodes: readonly DataroomNode[],
  parentId: string | null,
): DataroomNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

/** A single node by id (or undefined). */
export function findNode(nodes: readonly DataroomNode[], id: string): DataroomNode | undefined {
  return nodes.find((node) => node.id === id);
}

/**
 * The ancestor chain for a folder id, from the top-most ancestor down to and
 * including the folder itself. Used to render breadcrumbs. Unknown ids yield [].
 */
export function folderPath(
  nodes: readonly DataroomNode[],
  folderId: string | null,
): DataroomNode[] {
  if (folderId === null) return [];
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const chain: DataroomNode[] = [];
  let current = byId.get(folderId);
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** Count of descendant folders and files under a node (for cascade-delete copy). */
export function subtreeCounts(
  nodes: readonly DataroomNode[],
  rootId: string,
): { folders: number; files: number } {
  const childrenByParent = new Map<string | null, DataroomNode[]>();
  for (const node of nodes) {
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node);
    childrenByParent.set(node.parentId, list);
  }
  let folders = 0;
  let files = 0;
  // Count descendants only (exclude the root node itself).
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop() as DataroomNode;
    if (node.type === 'folder') folders += 1;
    else files += 1;
    for (const child of childrenByParent.get(node.id) ?? []) stack.push(child);
  }
  return { folders, files };
}
