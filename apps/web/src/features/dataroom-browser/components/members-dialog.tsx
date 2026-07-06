import { getApiErrorMessage, useListMembers, useListUsers } from '@repo/api-client';
import type { MemberDtoRole } from '@repo/api-client';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { Label } from '@repo/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select';
import { Skeleton } from '@repo/ui/components/skeleton';
import { UserPlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/shared/components/user-avatar';
import { useMemberMutations } from '../hooks/use-member-mutations.mutation';

interface MembersDialogProps {
  dataroomId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_OPTIONS: readonly MemberDtoRole[] = ['viewer', 'editor', 'owner'];

export function MembersDialog({
  dataroomId,
  isOwner,
  open,
  onOpenChange,
}: Readonly<MembersDialogProps>) {
  const members = useListMembers(dataroomId);
  const users = useListUsers();
  const { addMember, updateMember, removeMember } = useMemberMutations(dataroomId);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<MemberDtoRole>('viewer');

  const memberList = members.data?.data ?? [];
  const ownerCount = memberList.filter((member) => member.role === 'owner').length;
  const memberIds = new Set(memberList.map((member) => member.user.id));
  const availableUsers = (users.data?.data ?? []).filter((user) => !memberIds.has(user.id));
  const userId = selectedUserId || availableUsers[0]?.id || '';
  const busy = updateMember.isPending || removeMember.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'Owners can change roles and add or remove people.'
              : 'Who has access to this data room.'}
          </DialogDescription>
        </DialogHeader>

        {members.isPending ? (
          <div className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : members.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(members.error)}</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-auto">
            {memberList.map((member) => {
              const lastOwner = member.role === 'owner' && ownerCount <= 1;
              return (
                <li key={member.user.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <UserAvatar user={member.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  {isOwner ? (
                    <>
                      <Select
                        value={member.role}
                        disabled={lastOwner || busy}
                        onValueChange={(value) =>
                          updateMember.mutate({
                            id: dataroomId,
                            userId: member.user.id,
                            data: { role: value as MemberDtoRole },
                          })
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-[104px]"
                          aria-label={`Role for ${member.user.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option} className="capitalize">
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${member.user.name}`}
                        disabled={lastOwner || busy}
                        onClick={() =>
                          removeMember.mutate({ id: dataroomId, userId: member.user.id })
                        }
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground capitalize">
                      {member.role}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isOwner ? (
          <div className="grid gap-3 rounded-lg border bg-background/60 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="member-user">Add member</Label>
              <Select
                value={userId || undefined}
                onValueChange={setSelectedUserId}
                disabled={availableUsers.length === 0}
              >
                <SelectTrigger id="member-user">
                  <SelectValue placeholder="Everyone already has access" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="member-role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as MemberDtoRole)}>
                <SelectTrigger id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!userId || addMember.isPending}
              onClick={() => addMember.mutate({ id: dataroomId, data: { userId, role } })}
            >
              <UserPlusIcon className="size-4" />
              {addMember.isPending ? 'Adding...' : 'Add member'}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
