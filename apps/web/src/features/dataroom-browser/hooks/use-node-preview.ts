import { useRef, useState } from 'react';
import type { DataroomNode } from '@repo/domain';
import { findNode } from '../helpers/node-tree';

interface UseNodePreviewOptions {
  nodes: readonly DataroomNode[];
  /** A node to reveal on first render (from a favorites deep-link, `?select=`). */
  selectNodeId?: string | null;
  /** Called once the select target has been revealed, so the URL param can clear. */
  onConsumeSelect?: () => void;
}

/**
 * The detail panel follows a single click (preview), independent of checkbox
 * selection. Also owns the `?select` deep-link reveal: the target row's
 * callback ref fires {@link revealNode} exactly once per folder mount — scroll
 * into view, open details, clear the URL param. No effect needed.
 */
export function useNodePreview({ nodes, selectNodeId, onConsumeSelect }: UseNodePreviewOptions) {
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const revealedRef = useRef(false);

  const previewNode = previewNodeId ? (findNode(nodes, previewNodeId) ?? null) : null;

  function openPreview(node: DataroomNode): void {
    setPreviewNodeId(node.id);
  }

  function closePreview(): void {
    setPreviewNodeId(null);
  }

  function revealNode(node: DataroomNode, element: HTMLElement | null): void {
    if (revealedRef.current || !element || node.id !== selectNodeId) return;
    revealedRef.current = true;
    element.scrollIntoView({ block: 'center' });
    setPreviewNodeId(node.id);
    onConsumeSelect?.();
  }

  return { previewNode, openPreview, closePreview, revealNode };
}
