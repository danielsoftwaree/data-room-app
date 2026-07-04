export function sanitizeHeaderFilename(name: string): string {
  return name.replace(/["\\\r\n]/g, '_');
}
