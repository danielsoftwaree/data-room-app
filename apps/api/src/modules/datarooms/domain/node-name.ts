import { NODE_NAME_ERROR_MESSAGES, validateNodeName } from '@repo/domain';
import { InvalidInputError } from './errors';

export function parseNodeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new InvalidInputError('Name must be a string');
  const result = validateNodeName(raw);
  if (!result.ok) throw new InvalidInputError(NODE_NAME_ERROR_MESSAGES[result.error]);
  return result.name;
}
