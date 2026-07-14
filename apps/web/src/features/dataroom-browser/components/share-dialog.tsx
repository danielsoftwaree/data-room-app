import { useState } from 'react';
import { getApiErrorMessage, useGetNodeShare } from '@repo/api-client';
import type { ShareDto } from '@repo/contracts';
import type { FileNode } from '@repo/domain';
import { SHARE_PASSWORD_ERROR_MESSAGES, validateSharePassword } from '@repo/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { CopyIcon, LinkIcon, Trash2Icon } from 'lucide-react';
import { useShareMutations } from '../hooks/use-share-mutations.mutation';

interface ShareDialogProps {
  /** The file to manage sharing for, or null when the dialog is closed. */
  file: FileNode | null;
  dataroomId: string;
  onClose: () => void;
}

/**
 * Create, rotate, or remove a file's password-protected public share link.
 *
 * Radix unmounts DialogContent on close, so the body (and its password inputs)
 * remounts fresh on every open — no reset effect, and passwords never linger in
 * state. `useGetNodeShare` lives in the body too, so it only runs while open.
 */
export function ShareDialog({ file, dataroomId, onClose }: Readonly<ShareDialogProps>) {
  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {file ? <ShareDialogBody key={file.id} file={file} dataroomId={dataroomId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ShareDialogBody({ file, dataroomId }: Readonly<{ file: FileNode; dataroomId: string }>) {
  const shareState = useGetNodeShare(file.id);
  const mutations = useShareMutations(dataroomId);
  const share = shareState.data?.data.share ?? null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6 text-left">Share “{file.name}”</DialogTitle>
        <DialogDescription>
          Anyone with the link and password can view and download this file — no account needed.
        </DialogDescription>
      </DialogHeader>

      {shareState.isPending ? (
        <div className="flex flex-col gap-2 py-2" aria-busy>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : shareState.isError ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          {getApiErrorMessage(shareState.error)}
        </p>
      ) : share ? (
        <ShareLinkView fileId={file.id} share={share} mutations={mutations} />
      ) : (
        <CreateShareForm fileId={file.id} mutations={mutations} />
      )}
    </>
  );
}

/** No link yet: pick a password and create the link. */
function CreateShareForm({
  fileId,
  mutations,
}: Readonly<{ fileId: string; mutations: ReturnType<typeof useShareMutations> }>) {
  const { upsertShare } = mutations;
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const validation = validateSharePassword(password);
  const inlineError = validation.ok ? null : SHARE_PASSWORD_ERROR_MESSAGES[validation.error];
  const serverError = upsertShare.isError ? getApiErrorMessage(upsertShare.error) : null;

  function submit(): void {
    setTouched(true);
    if (!validation.ok || upsertShare.isPending) return;
    upsertShare.mutate(
      { id: fileId, data: { password } },
      { onSuccess: () => toast.success('Share link created') },
    );
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="share-password">Password</Label>
      <div className="flex gap-2">
        <Input
          id="share-password"
          type="password"
          autoFocus
          autoComplete="new-password"
          value={password}
          placeholder="At least 4 characters"
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && (inlineError !== null || Boolean(serverError))}
        />
        <Button type="submit" disabled={!validation.ok || upsertShare.isPending}>
          <LinkIcon className="size-4" />
          {upsertShare.isPending ? 'Creating…' : 'Create link'}
        </Button>
      </div>
      {touched && inlineError ? (
        <p className="text-sm text-destructive">{inlineError}</p>
      ) : serverError ? (
        <p className="text-sm text-destructive">{serverError}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Viewers must enter this password to open the file.
        </p>
      )}
    </form>
  );
}

/** A link exists: show it, allow copy, password rotation, and removal. */
function ShareLinkView({
  fileId,
  share,
  mutations,
}: Readonly<{
  fileId: string;
  share: ShareDto;
  mutations: ReturnType<typeof useShareMutations>;
}>) {
  const { upsertShare, removeShare } = mutations;
  const shareUrl = `${window.location.origin}/share/${share.slug}`;
  const [changing, setChanging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function copyLink(): void {
    void navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied');
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="share-link">Share link</Label>
        <div className="flex gap-2">
          <Input
            id="share-link"
            readOnly
            value={shareUrl}
            aria-label="Share link"
            className="font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={copyLink}>
            <CopyIcon className="size-4" />
            Copy
          </Button>
        </div>
      </div>

      {changing ? (
        <ChangePasswordForm
          fileId={fileId}
          pending={upsertShare.isPending}
          serverError={upsertShare.isError ? getApiErrorMessage(upsertShare.error) : null}
          onCancel={() => setChanging(false)}
          onSubmit={(password) =>
            upsertShare.mutate(
              { id: fileId, data: { password } },
              {
                onSuccess: () => {
                  toast.success('Password updated');
                  setChanging(false);
                },
              },
            )
          }
        />
      ) : (
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => setChanging(true)}>
            Change password
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2Icon className="size-4" />
            Remove link
          </Button>
        </div>
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove share link?</AlertDialogTitle>
            <AlertDialogDescription>
              The link will stop working immediately and anyone you shared it with will lose
              access. Creating a new link later generates a different address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeShare.isPending}
              onClick={(event) => {
                event.preventDefault();
                removeShare.mutate(
                  { id: fileId },
                  { onSuccess: () => setConfirmRemove(false) },
                );
              }}
            >
              {removeShare.isPending ? 'Removing…' : 'Remove link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Inline "rotate the password" form. The slug (and link) stays the same. */
function ChangePasswordForm({
  fileId,
  pending,
  serverError,
  onCancel,
  onSubmit,
}: Readonly<{
  fileId: string;
  pending: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}>) {
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const validation = validateSharePassword(password);
  const inlineError = validation.ok ? null : SHARE_PASSWORD_ERROR_MESSAGES[validation.error];

  return (
    <form
      className="grid gap-2 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!validation.ok || pending) return;
        onSubmit(password);
      }}
    >
      <Label htmlFor={`share-new-password-${fileId}`}>New password</Label>
      <div className="flex gap-2">
        <Input
          id={`share-new-password-${fileId}`}
          type="password"
          autoFocus
          autoComplete="new-password"
          value={password}
          placeholder="At least 4 characters"
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && (inlineError !== null || Boolean(serverError))}
        />
        <Button type="submit" disabled={!validation.ok || pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {touched && inlineError ? (
        <p className="text-sm text-destructive">{inlineError}</p>
      ) : serverError ? (
        <p className="text-sm text-destructive">{serverError}</p>
      ) : (
        <p className="text-sm text-muted-foreground">The link stays the same.</p>
      )}
    </form>
  );
}
