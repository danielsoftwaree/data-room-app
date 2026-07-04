export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileContentPayload {
  name: string;
  size: number;
  content: Buffer;
  contentType: string;
}
