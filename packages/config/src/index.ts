/**
 * App-agnostic, truly global constants shared by web and api.
 */
export const API_PREFIX = 'api';

export const UPLOAD = {
  acceptedMimeTypes: ['application/pdf'],
  acceptedExtensions: ['.pdf'],
  maxFileSizeBytes: 50 * 1024 * 1024,
} as const;

export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
