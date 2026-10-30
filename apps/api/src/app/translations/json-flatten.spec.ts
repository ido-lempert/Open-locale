import { flattenJson, unflattenJson } from './json-flatten';

describe('json-flatten', () => {
  it('flattens nested objects with dotted names', () => {
    expect(
      flattenJson({ checkout: { pay_button: 'Pay', cart: { title: 'Cart' } }, home: 'Home' }).flat,
    ).toEqual({
      'checkout.pay_button': 'Pay',
      'checkout.cart.title': 'Cart',
      home: 'Home',
    });
  });

  it('round-trips through unflatten', () => {
    const flat = { 'a.b.c': 'x', 'a.b.d': 'y', e: 'z' };
    expect(flattenJson(unflattenJson(flat) as Record<string, unknown>).flat).toEqual(flat);
  });

  it('reports non-string leaves as rejected instead of dropping them silently', () => {
    const { flat, rejected } = flattenJson({ a: { b: 5, c: true, d: 'ok' }, e: [1, 2], f: null });
    expect(flat).toEqual({ 'a.d': 'ok' });
    expect(rejected.sort()).toEqual(['a.b', 'a.c', 'e', 'f']);
  });
});

// Regression must not leave global state dirty even when run against old code.
describe('JSON prototype isolation', () => {
  it('does not traverse Object.prototype when exporting dotted keys', () => {
    try {
      const result = unflattenJson({ '__proto__.openLocaleProbe': 'value', 'constructor.prototype.label': 'text' });
      expect((Object.prototype as Record<string, unknown>).openLocaleProbe).toBeUndefined();
      expect(JSON.parse(JSON.stringify(result))).toEqual(JSON.parse('{"__proto__":{"openLocaleProbe":"value"},"constructor":{"prototype":{"label":"text"}}}'));
    } finally { delete (Object.prototype as Record<string, unknown>).openLocaleProbe; }
  });
  it('preserves exact prototype-named string keys when flattening and round-tripping', () => {
    const input = JSON.parse('{"__proto__":"data","constructor":"ctor","toString":"string"}');
    const flat = flattenJson(input).flat;
    expect(Object.keys(flat).sort()).toEqual(['__proto__','constructor','toString'].sort());
    expect(JSON.parse(JSON.stringify(unflattenJson(flat)))).toEqual(input);
  });
});
