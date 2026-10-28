import { flattenJson, unflattenJson } from './json-flatten';

describe('json-flatten', () => {
  it('flattens nested objects with dotted names', () => {
    expect(
      flattenJson({ checkout: { pay_button: 'Pay', cart: { title: 'Cart' } }, home: 'Home' }),
    ).toEqual({
      'checkout.pay_button': 'Pay',
      'checkout.cart.title': 'Cart',
      home: 'Home',
    });
  });

  it('round-trips through unflatten', () => {
    const flat = { 'a.b.c': 'x', 'a.b.d': 'y', e: 'z' };
    expect(flattenJson(unflattenJson(flat) as Record<string, unknown>)).toEqual(flat);
  });

  it('ignores non-string leaves', () => {
    expect(flattenJson({ a: { b: 5, c: true, d: 'ok' } })).toEqual({ 'a.d': 'ok' });
  });
});
