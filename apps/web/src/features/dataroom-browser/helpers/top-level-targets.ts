import type { DataroomNode } from '@repo/domain';
import { findNode } from '../../../shared/node-tree';

/**
 * Keep only targets whose ancestors are not themselves selected, so a bulk
 * action on a folder and its descendants runs once at the top of the subtree.
 */
export function topLevelTargets(
  targets: readonly DataroomNode[],
  allNodes: readonly DataroomNode[],
): DataroomNode[] {
  const selected = new Set(targets.map((target) => target.id));
  return targets.filter((target) => {
    let current = target.parentId ? findNode(allNodes, target.parentId) : undefined;
    while (current) {
      if (selected.has(current.id)) return false;
      current = current.parentId ? findNode(allNodes, current.parentId) : undefined;
    }
    return true;
  });
}
