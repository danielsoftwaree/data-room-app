import { useState } from 'react';
import { getApiErrorMessage, useGetNodeShare } from '@repo/api-client';
import type { ShareDto } from '@repo/contracts';
import type { DataroomNode } from '@repo/domain';
import { SHARE_PASSWORD_ERROR_MESSAGES, validateSharePassword } from '@repo/domain';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { Switch } from '@repo/ui/components/switch';
import { CopyIcon, GlobeIcon, LinkIcon, LockKeyholeIcon, UsersIcon } from 'lucide-react';
import { useShareMutations } from '../hooks/use-share-mutations.mutation';

interface ShareDialogProps {
  /** The node (file or folder) to manage sharing for, or null when the dialog is closed. */
  node: DataroomNode | null;
  dataroomId: string;
  onClose: () => void;
}

/**
 * Google-Drive-style link sharing for a file or folder. One "General access"
 * control switches between Restricted (members only, no link) and Anyone with
 * the link; an optional password is a separate toggle on top of the link, so
 * the common path — copy a link in two clicks — stays front and center.
 *
 * Radix unmounts DialogContent on close, so the body (and its password inputs)
 * remounts fresh on every open — no reset effect, and passwords never linger in
 * state. `useGetNodeShare` lives in the body too, so it only runs while open.
 */
export function ShareDialog({ node, dataroomId, onClose }: Readonly<ShareDialogProps>) {
  return (
    <Dialog
      open={node !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {node ? (
          <ShareDialogBody key={node.id} node={node} dataroomId={dataroomId} onDone={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ShareDialogBody({
  node,
  dataroomId,
  onDone,
}: Readonly<{ node: DataroomNode; dataroomId: string; onDone: () => void }>) {
  const shareState = useGetNodeShare(node.id);
  const mutations = useShareMutations(dataroomId);
  const { upsertShare, removeShare } = mutations;
  const share = shareState.data?.data.share ?? null;
  const noun = node.type === 'folder' ? 'folder' : 'file';
  const shareUrl = share ? `${window.location.origin}/share/${share.slug}` : null;
  const busy = upsertShare.isPending || removeShare.isPending;
  const serverError =
    (upsertShare.isError ? getApiErrorMessage(upsertShare.error) : null) ??
    (removeShare.isError ? getApiErrorMessage(removeShare.error) : null);

  function copyLink(): void {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied');
  }

  function changeAccess(value: string): void {
    if (busy) return;
    if (value === 'link' && !share) {
      upsertShare.mutate(
        { id: node.id, data: { password: null } },
        { onSuccess: () => toast.success('Share link created') },
      );
    } else if (value === 'restricted' && share) {
      removeShare.mutate({ id: node.id });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6 text-left">Share “{node.name}”</DialogTitle>
        <DialogDescription className="sr-only">
          Manage the public share link for this {noun}.
        </DialogDescription>
      </DialogHeader>

      {shareState.isPending ? (
        <div className="flex flex-col gap-2 py-2" aria-busy>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : shareState.isError ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          {getApiErrorMessage(shareState.error)}
        </p>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">General access</p>
            <div className="flex items-center gap-3 rounded-lg border bg-background/60 p-3">
              <span
                className={
                  share
                    ? 'grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary'
                    : 'grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground'
                }
              >
                {share ? <GlobeIcon className="size-4" /> : <UsersIcon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <Select
                  value={share ? 'link' : 'restricted'}
                  onValueChange={changeAccess}
                  disabled={busy}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label="General access"
                    className="w-fit border-none bg-transparent font-medium shadow-none dark:bg-transparent"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="link">Anyone with the link</SelectItem>
                  </SelectContent>
                </Select>
                <p className="px-3 text-xs text-muted-foreground">
                  {share
                    ? `Anyone on the internet with the link can view this ${noun}`
                    : `Only data room members can open this ${noun}`}
                </p>
              </div>
            </div>
          </div>

          {share && shareUrl ? (
            <>
              <div className="flex gap-2">
                <Input
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

              <PasswordSection nodeId={node.id} share={share} mutations={mutations} busy={busy} />
            </>
          ) : null}

          {serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            {share ? (
              <Button type="button" variant="outline" onClick={copyLink}>
                <LinkIcon className="size-4" />
                Copy link
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The optional password gate on top of an existing link. The switch reflects
 * whether a password is set; turning it on reveals the inline form (nothing is
 * saved until Save), turning it off removes the password immediately.
 */
function PasswordSection({
  nodeId,
  share,
  mutations,
  busy,
}: Readonly<{
  nodeId: string;
  share: ShareDto;
  mutations: ReturnType<typeof useShareMutations>;
  busy: boolean;
}>) {
  const { upsertShare } = mutations;
  const [formOpen, setFormOpen] = useState(false);
  const checked = share.hasPassword || formOpen;

  function toggle(next: boolean): void {
    if (busy) return;
    if (next) {
      setFormOpen(true);
    } else if (share.hasPassword) {
      upsertShare.mutate(
        { id: nodeId, data: { password: null } },
        {
          onSuccess: () => {
            toast.success('Password removed');
            setFormOpen(false);
          },
        },
      );
    } else {
      setFormOpen(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <LockKeyholeIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Label htmlFor="share-require-password" className="text-sm font-medium">
            Require password
          </Label>
          <p className="text-xs text-muted-foreground">
            {share.hasPassword
              ? 'Viewers must enter the password to open the link'
              : 'Add a password on top of the link'}
          </p>
        </div>
        <Switch
          id="share-require-password"
          checked={checked}
          disabled={busy}
          onCheckedChange={toggle}
        />
      </div>

      {formOpen ? (
        <PasswordForm
          nodeId={nodeId}
          hasPassword={share.hasPassword}
          pending={upsertShare.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={(password) =>
            upsertShare.mutate(
              { id: nodeId, data: { password } },
              {
                onSuccess: () => {
                  toast.success(share.hasPassword ? 'Password updated' : 'Password set');
                  setFormOpen(false);
                },
              },
            )
          }
        />
      ) : share.hasPassword ? (
        <div className="flex items-center justify-between gap-2 pl-12">
          <p className="text-xs text-muted-foreground">Password is set</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(true)}>
            Change password
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Inline password form. The link itself stays the same. */
function PasswordForm({
  nodeId,
  hasPassword,
  pending,
  onCancel,
  onSubmit,
}: Readonly<{
  nodeId: string;
  hasPassword: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}>) {
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const validation = validateSharePassword(password);
  const inlineError = validation.ok ? null : SHARE_PASSWORD_ERROR_MESSAGES[validation.error];

  return (
    <form
      className="grid gap-2 pl-12"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!validation.ok || pending) return;
        onSubmit(validation.password);
      }}
    >
      <Label htmlFor={`share-password-${nodeId}`} className="sr-only">
        {hasPassword ? 'New password' : 'Password'}
      </Label>
      <div className="flex gap-2">
        <Input
          id={`share-password-${nodeId}`}
          type="password"
          autoFocus
          autoComplete="new-password"
          value={password}
          placeholder="At least 4 characters"
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && inlineError !== null}
        />
        <Button type="submit" disabled={!validation.ok || pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {touched && inlineError ? <p className="text-sm text-destructive">{inlineError}</p> : null}
    </form>
  );
}
