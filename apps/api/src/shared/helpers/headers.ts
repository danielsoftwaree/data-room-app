/**
 * Content-Disposition value with a Latin-1-safe fallback name plus RFC 5987
 * filename* so non-ASCII names (e.g. Cyrillic) survive: raw non-ASCII bytes in
 * a header value make Node's setHeader throw ERR_INVALID_CHAR (an opaque 500).
 */
export function contentDispositionInline(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
