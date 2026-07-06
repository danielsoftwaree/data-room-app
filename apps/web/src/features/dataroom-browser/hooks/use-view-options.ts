import { useMemo, useState } from 'react';
import type { DataroomNode } from '@repo/domain';
import { useUiStore } from '@/shared/store/ui-store';
import { filterNodes } from '../helpers/filter-nodes';
import { sortVisibleNodes } from '../helpers/sort-nodes';
import type { FilterMode, SortDir, SortKey } from '../types';

/**
 * How the current folder is displayed: type filter and sort key/direction are
 * per-visit state (reset on navigation); the list/grid switch is the persisted
 * preference from the UI store.
 */
export function useViewOptions(baseNodes: readonly DataroomNode[]) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);

  const visibleNodes = useMemo(
    () => sortVisibleNodes(filterNodes(baseNodes, filter), sortKey, sortDir),
    [baseNodes, filter, sortKey, sortDir],
  );

  return {
    filter,
    setFilter,
    sortKey,
    setSortKey,
    sortDir,
    toggleSortDir: () => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc')),
    view,
    setView,
    visibleNodes,
  };
}
