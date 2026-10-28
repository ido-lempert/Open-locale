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
