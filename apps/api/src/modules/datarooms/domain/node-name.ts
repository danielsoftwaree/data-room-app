import type { NameValidationError } from '@repo/domain';
import { NODE_NAME_MAX_LENGTH, validateNodeName } from '@repo/domain';
import { InvalidInputError } from './errors';

const NAME_ERROR_MESSAGES: Record<NameValidationError, string> = {
  empty: 'Name cannot be empty',
  'too-long': `Name cannot be longer than ${NODE_NAME_MAX_LENGTH} characters`,
  'invalid-chars': 'Name contains characters that are not allowed: \\ / : * ? " < > |',
};

export function parseNodeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new InvalidInputError('Name must be a string');
  const result = validateNodeName(raw);
  if (!result.ok) throw new InvalidInputError(NAME_ERROR_MESSAGES[result.error]);
  return result.name;
}
