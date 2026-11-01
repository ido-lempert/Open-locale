// Internal bounded rule selection, not an execution grant. 1000 UUIDs occupy
// at most 39KB serialized; reject malformed stored selections rather than widen.
export const REPOSITORY_RULE_CAP = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseRepositoryRuleIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > REPOSITORY_RULE_CAP ||
      !value.every((id) => typeof id === 'string' && UUID.test(id)) ||
      new Set(value.map((id) => String(id).toLowerCase())).size !== value.length)
    throw new Error('Repository automation rule selection unavailable');
  return value as string[];
}
