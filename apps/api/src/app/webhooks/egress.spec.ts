import { isDeniedIp, validateWebhookUrlString, WebhookTargetError } from './egress';

describe('webhook egress hardening', () => {
  it('denies loopback, private, link-local, reserved and documentation IPv4', () => {
    for (const ip of ['127.0.0.1', '127.5.6.7', '10.1.2.3', '172.16.0.5', '172.31.255.255',
      '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '198.18.0.1',
      '224.0.0.1', '240.1.2.3', '192.0.2.1', '203.0.113.9']) {
      expect(isDeniedIp(ip)).toBe(true);
    }
  });
  it('denies IPv6 loopback, ULA, link-local, multicast and v4-embedding transition forms', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12::9', 'fe80::1', 'ff02::1',
      '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::1', '2001:db8::1']) {
      expect(isDeniedIp(ip)).toBe(true);
    }
  });
  it('allows ordinary public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '192.169.0.1', '2606:4700:4700::1111']) {
      expect(isDeniedIp(ip)).toBe(false);
    }
  });
  it('rejects credentials, non-http schemes and blocked ports at the URL layer', () => {
    expect(() => validateWebhookUrlString('ftp://example.com/hook')).toThrow(WebhookTargetError);
    expect(() => validateWebhookUrlString('http://user:pass@example.com/hook')).toThrow(WebhookTargetError);
    expect(() => validateWebhookUrlString('https://example.com:22/hook')).toThrow(WebhookTargetError);
    expect(() => validateWebhookUrlString('https://example.com:6379/hook')).toThrow(WebhookTargetError);
  });
  it('rejects internal IP literals at the URL layer without any DNS lookup', () => {
    for (const u of ['http://127.0.0.1/hook', 'http://[::1]/hook', 'http://[::ffff:127.0.0.1]/hook', 'http://169.254.169.254/latest/meta-data']) {
      expect(() => validateWebhookUrlString(u)).toThrow(WebhookTargetError);
    }
  });
});
