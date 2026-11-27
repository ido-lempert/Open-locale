// GET/HEAD If-None-Match uses weak comparison (RFC9110 section13.1.2).
// Validate the whole list first: malformed fields never become cache hits.
// Commas inside opaque quoted tags are data, not list separators.
const tag = '(?:W/)?"[\\x21\\x23-\\x7e\\x80-\\xff]*"';
const list = new RegExp(`^[ \t]*(?:${tag})?[ \t]*(?:,[ \t]*(?:${tag})?[ \t]*)*$`);
const tags = new RegExp(tag, 'g');
export function matchesIfNoneMatch(header: string | undefined, etag: string): boolean {
  if (!header || /[\r\n]/.test(header)) return false;
  if (/^[ \t]*\*[ \t]*$/.test(header)) return true;
  if (!list.test(header)) return false;
  const opaque = etag.replace(/^W\//, '');
  return (header.match(tags) ?? []).some(candidate => candidate.replace(/^W\//, '') === opaque);
}
