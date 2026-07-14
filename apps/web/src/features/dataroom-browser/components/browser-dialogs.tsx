import { getApiErrorMessage } from '@repo/api-client';
import type { DataroomNode } from '@repo/domain';
import { NameDialog } from '@/shared/components/name-dialog';
import type { BrowserDialog } from '../hooks/use-browser-dialogs';
import type { NodeMutations } from '../hooks/use-node-mutations.mutation';
import { MembersDialog } from './members-dialog';
import { MoveDialog } from './move-dialog';
import { PdfViewerDialog } from './pdf-viewer-dialog';
import { ShareDialog } from './share-dialog';

interface BrowserDialogsProps {
  dataroomId: string;
  folderId: string | null;
  /** The currently open modal from {@link useBrowserDialogs}, or null. */
  dialog: BrowserDialog | null;
  onClose: () => void;
  nodes: readonly DataroomNode[];
  /** Names next to the create/rename target, for instant duplicate feedback. */
  siblingNames: readonly string[];
  isOwner: boolean;
  mutations: NodeMutations;
  /** Runs after every move target succeeded (e.g. to clear the selection). */
  onMoved: () => void;
}

/** All browser modals in one place, driven by the single dialog state. */
export function BrowserDialogs({
  dataroomId,
  folderId,
  dialog,
  onClose,
  nodes,
  siblingNames,
  isOwner,
  mutations,
  onMoved,
}: Readonly<BrowserDialogsProps>) {
  const { createFolder, renameNode, moveNode } = mutations;
  const renameTarget = dialog?.kind === 'rename' ? dialog.node : null;
  const moveTargets = dialog?.kind === 'move' ? dialog.targets : null;

  async function confirmMove(parentId: string | null): Promise<void> {
    if (!moveTargets) return;
    try {
      for (const target of moveTargets) {
        await moveNode.mutateAsync({ id: target.id, data: { parentId } });
      }
    } catch {
      return; // moveNode's onError already showed a toast; keep the dialog open.
    }
    onMoved();
    onClose();
  }

  return (
    <>
      <NameDialog
        open={dialog?.kind === 'create-folder'}
        onOpenChange={(open) => {
          if (open) return;
          // Closing clears any stale server error before the next open.
          createFolder.reset();
          onClose();
        }}
        title="New folder"
        label="Folder name"
        submitLabel="Create"
        placeholder="e.g. Financials"
        existingNames={siblingNames}
        pending={createFolder.isPending}
        serverError={createFolder.isError ? getApiErrorMessage(createFolder.error) : null}
        onSubmit={(name) =>
          createFolder.mutate(
            { id: dataroomId, data: { parentId: folderId, name } },
            { onSuccess: onClose },
          )
        }
      />

      <NameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (open) return;
          renameNode.reset();
          onClose();
        }}
        title={renameTarget?.type === 'folder' ? 'Rename folder' : 'Rename file'}
        label="Name"
        submitLabel="Rename"
        initialName={renameTarget?.name ?? ''}
        existingNames={siblingNames.filter((name) => name !== renameTarget?.name)}
        pending={renameNode.isPending}
        serverError={renameNode.isError ? getApiErrorMessage(renameNode.error) : null}
        onSubmit={(name) => {
          if (!renameTarget) return;
          renameNode.mutate({ id: renameTarget.id, data: { name } }, { onSuccess: onClose });
        }}
      />

      <MoveDialog
        open={moveTargets !== null}
        nodes={nodes}
        targets={moveTargets ?? []}
        pending={moveNode.isPending}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onMove={(parentId) => void confirmMove(parentId)}
      />

      <MembersDialog
        dataroomId={dataroomId}
        isOwner={isOwner}
        open={dialog?.kind === 'members'}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />

      <PdfViewerDialog file={dialog?.kind === 'viewer' ? dialog.file : null} onClose={onClose} />

      <ShareDialog
        node={dialog?.kind === 'share' ? dialog.node : null}
        dataroomId={dataroomId}
        onClose={onClose}
      />
    </>
  );
}
