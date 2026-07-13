import { useRef, useState, type DragEvent } from 'react';

interface UseDropUploadOptions {
  /** Viewers can't upload, so the drop target stays inert for them. */
  enabled: boolean;
  onDropFiles: (files: File[]) => void;
}

/**
 * Drag-and-drop upload over a container: reacts only to OS drags that carry
 * files, balances child dragenter/dragleave pairs with a depth counter (so
 * the highlight doesn't flicker while moving over rows), and hands dropped
 * files to the regular upload flow, which validates and reports per file.
 */
export function useDropUpload({ enabled, onDropFiles }: UseDropUploadOptions) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const depth = useRef(0);

  function isFileDrag(event: DragEvent): boolean {
    return enabled && event.dataTransfer.types.includes('Files');
  }

  function onDragEnter(event: DragEvent): void {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    depth.current += 1;
    setIsDropTarget(true);
  }

  function onDragOver(event: DragEvent): void {
    if (!isFileDrag(event)) return;
    // Without this the browser refuses the drop and never fires onDrop.
    event.preventDefault();
  }

  function onDragLeave(event: DragEvent): void {
    if (!isFileDrag(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDropTarget(false);
  }

  function onDrop(event: DragEvent): void {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    depth.current = 0;
    setIsDropTarget(false);
    onDropFiles(Array.from(event.dataTransfer.files));
  }

  return {
    isDropTarget,
    dropTargetProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
