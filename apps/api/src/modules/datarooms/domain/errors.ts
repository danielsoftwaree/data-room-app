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

/** Public share endpoints: unknown slug, or the shared node is trashed/missing. */
export class ShareNotFoundError extends DataroomModuleError {
  readonly kind = 'share-not-found';

  constructor(message = 'Share link not found') {
    super(message);
  }
}

/** The share has a password but the request carried none (the UI's anonymous probe). */
export class SharePasswordRequiredError extends DataroomModuleError {
  readonly kind = 'share-password-required';

  constructor(message = 'Password required') {
    super(message);
  }
}

export class InvalidSharePasswordError extends DataroomModuleError {
  readonly kind = 'invalid-share-password';

  constructor(message = 'Incorrect password') {
    super(message);
  }
}

export class ShareRateLimitedError extends DataroomModuleError {
  readonly kind = 'share-rate-limited';

  constructor(message = 'Too many attempts. Try again later.') {
    super(message);
  }
}
