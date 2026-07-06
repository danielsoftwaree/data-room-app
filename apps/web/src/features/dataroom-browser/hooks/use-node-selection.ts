import { useState } from 'react';
import type { DataroomNode } from '@repo/domain';

/**
 * Checkbox selection over the visible list: single toggle, shift-click range
 * extension from the last-touched row, select-all/none. Selection drives the
 * bulk bar and is independent of the single-click preview.
 */
export function useNodeSelection(visibleNodes: readonly DataroomNode[]) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const selectedNodes = visibleNodes.filter((node) => selectedIds.has(node.id));

  function toggleSelect(node: DataroomNode, extend: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (extend && lastSelectedId) {
        const from = visibleNodes.findIndex((candidate) => candidate.id === lastSelectedId);
        const to = visibleNodes.findIndex((candidate) => candidate.id === node.id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          for (const candidate of visibleNodes.slice(start, end + 1)) next.add(candidate.id);
          return next;
        }
      }
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    setLastSelectedId(node.id);
  }

  function selectAll(): void {
    setSelectedIds(new Set(visibleNodes.map((node) => node.id)));
  }

  /** Header checkbox: everything visible selected → clear, otherwise select all. */
  function toggleAll(): void {
    setSelectedIds((current) =>
      visibleNodes.every((node) => current.has(node.id))
        ? new Set()
        : new Set(visibleNodes.map((node) => node.id)),
    );
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  return { selectedIds, selectedNodes, toggleSelect, selectAll, toggleAll, clearSelection };
}
