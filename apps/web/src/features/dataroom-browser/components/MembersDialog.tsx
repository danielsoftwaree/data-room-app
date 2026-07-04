import { useQueryClient } from '@tanstack/react-query';
import {
  getApiErrorMessage,
  getListActivityQueryKey,
  getListMembersQueryKey,
  useAddMember,
  useListMembers,
  useListUsers,
  useRemoveMember,
} from '@repo/api-client';
import type { UserDto } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { Label } from '@repo/ui/components/label';
import { Skeleton } from '@repo/ui/components/skeleton';
import { toast } from '@repo/ui/components/sonner';
import { cn } from '@repo/ui/lib/utils';
import { UserPlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

interface MembersDialogProps {
  dataroomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MembersDialog({ dataroomId, open, onOpenChange }: Readonly<MembersDialogProps>) {
  const queryClient = useQueryClient();
  const members = useListMembers(dataroomId);
  const users = useListUsers();
  const addMember = useAddMember({
    mutation: {
      onSuccess: () => {
        toast.success('Member added');
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });
  const removeMember = useRemoveMember({
    mutation: {
      onSuccess: () => {
        toast.success('Member removed');
        invalidate();
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    },
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');

  const memberIds = new Set((members.data?.data ?? []).map((member) => member.user.id));
  const availableUsers = (users.data?.data ?? []).filter((user) => !memberIds.has(user.id));
  const userId = selectedUserId || availableUsers[0]?.id || '';

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: getListMembersQueryKey(dataroomId) });
    void queryClient.invalidateQueries({ queryKey: getListActivityQueryKey(dataroomId) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>Demo access list for this data room.</DialogDescription>
        </DialogHeader>

        {members.isPending ? (
          <div className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : members.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(members.error)}</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
            {members.data.data.map((member) => (
              <li key={member.user.id} className="flex items-center gap-3 rounded-lg border p-3">
                <MemberAvatar user={member.user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground capitalize">
                  {member.role}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${member.user.name}`}
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate({ id: dataroomId, userId: member.user.id })}
                >
                  <XIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 rounded-lg border bg-background/60 p-3">
          <div className="grid gap-1.5">
            <Label htmlFor="member-user">Add member</Label>
            <select
              id="member-user"
              value={userId}
              onChange={(event) => setSelectedUserId(event.currentTarget.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              disabled={availableUsers.length === 0}
            >
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-role">Role</Label>
            <select
              id="member-role"
              value={role}
              onChange={(event) => setRole(event.currentTarget.value as typeof role)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <Button
            disabled={!userId || addMember.isPending}
            onClick={() => addMember.mutate({ id: dataroomId, data: { userId, role } })}
          >
            <UserPlusIcon className="size-4" />
            {addMember.isPending ? 'Adding...' : 'Add member'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberAvatar({ user }: Readonly<{ user: UserDto }>) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white',
        avatarColorClass(user.color),
      )}
    >
      {user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')}
    </span>
  );
}

function avatarColorClass(color: string): string {
  const classes: Record<string, string> = {
    '#5865f2': 'bg-primary',
    '#35ed7e': 'bg-emerald-400 text-foreground',
    '#a78bfa': 'bg-violet-400',
    '#f6c956': 'bg-yellow-400 text-foreground',
    '#ec48bd': 'bg-pink-500',
    '#00b0f4': 'bg-sky-500',
  };
  return classes[color] ?? 'bg-primary';
}
