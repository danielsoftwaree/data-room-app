export abstract class DataroomModuleError extends Error {
  abstract readonly kind: string;
}

export class DataroomNotFoundError extends DataroomModuleError {
  readonly kind = 'dataroom-not-found';

  constructor(message = 'Data room not found') {
    super(message);
  }
}

export class NodeNotFoundError extends DataroomModuleError {
  readonly kind = 'node-not-found';

  constructor(message = 'Node not found') {
    super(message);
  }
}

export class FileNotFoundError extends DataroomModuleError {
  readonly kind = 'file-not-found';

  constructor(message = 'File not found') {
    super(message);
  }
}

export class NameConflictError extends DataroomModuleError {
  readonly kind = 'name-conflict';

  constructor(message: string) {
    super(message);
  }
}

export class InvalidInputError extends DataroomModuleError {
  readonly kind = 'invalid-input';

  constructor(message: string) {
    super(message);
  }
}

export class PayloadTooLargeError extends DataroomModuleError {
  readonly kind = 'payload-too-large';

  constructor(message: string) {
    super(message);
  }
}
