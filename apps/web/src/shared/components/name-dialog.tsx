import { useState } from 'react';
import { isNameTaken, NODE_NAME_ERROR_MESSAGES, validateNodeName } from '@repo/domain';
import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';

interface NameFormProps {
  title: string;
  description?: string;
  label?: string;
  submitLabel?: string;
  initialName?: string;
  placeholder?: string;
  /** Sibling names for instant duplicate detection (case-insensitive). */
  existingNames?: readonly string[];
  pending?: boolean;
  serverError?: string | null;
  onSubmit: (name: string) => void;
}

/**
 * Generic "enter a name" dialog used for creating/renaming data rooms and
 * folders. Client-side validation mirrors @repo/domain (the same rules the API
 * enforces) for instant feedback; the parent still handles the mutation and
 * surfaces any server error (e.g. a duplicate that races us) via `serverError`.
 */
export function NameDialog({
  open,
  onOpenChange,
  ...formProps
}: NameFormProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <NameForm {...formProps} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Form state lives in this inner component on purpose: Radix unmounts
 * DialogContent when the dialog closes, so every open remounts the form with
 * fresh state (value = initialName, untouched) - no reset effect needed.
 */
function NameForm({
  title,
  description,
  label = 'Name',
  submitLabel = 'Save',
  initialName = '',
  placeholder,
  existingNames = [],
  pending = false,
  serverError,
  onSubmit,
  onCancel,
}: NameFormProps & { onCancel: () => void }) {
  const [value, setValue] = useState(initialName);
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const validation = validateNodeName(value);
  const unchanged = trimmed.toLowerCase() === initialName.trim().toLowerCase();
  const duplicate = validation.ok && !unchanged && isNameTaken(existingNames, trimmed);

  let inlineError: string | null = null;
  if (!validation.ok) inlineError = NODE_NAME_ERROR_MESSAGES[validation.error];
  else if (duplicate) inlineError = `"${trimmed}" already exists here`;

  const canSubmit = validation.ok && !duplicate && !pending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        onSubmit(trimmed);
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>

      <div className="grid gap-2 py-4">
        <Label htmlFor="name-dialog-input">{label}</Label>
        <Input
          id="name-dialog-input"
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && (inlineError !== null || Boolean(serverError))}
        />
        {touched && inlineError ? (
          <p className="text-sm text-destructive">{inlineError}</p>
        ) : serverError ? (
          <p className="text-sm text-destructive">{serverError}</p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
