export function flattenJson(input: Record<string, unknown>, prefix = '', rejected: string[] = []): { flat: Record<string, string>; rejected: string[] } {
  const out: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenJson(value as Record<string, unknown>, name, rejected);
      Object.assign(out, nested.flat);
    } else if (typeof value === 'string') {
      out[name] = value;
    } else {
      rejected.push(name);
    }
  }
  return { flat: out, rejected };
}

export function unflattenJson(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = Object.create(null);
  for (const [name, value] of Object.entries(flat)) {
    const parts = name.split('.');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!Object.prototype.hasOwnProperty.call(node, part) || typeof node[part] !== 'object' || node[part] === null) node[part] = Object.create(null);
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return root;
}
