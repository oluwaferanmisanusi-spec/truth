import { network } from './rate-limit.js';

describe('network', () => {
  it('counts IPv4 addresses one by one', () => {
    expect(network('203.0.113.7')).toBe('203.0.113.7');
    expect(network('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('counts IPv6 addresses by their /64, however they are written', () => {
    const net = network('2001:db8:aaaa:1::5');
    expect(net).toBe('2001:db8:aaaa:1::/64');
    expect(network('2001:0db8:aaaa:0001:ffff:0:0:9')).toBe(net);
    expect(network('2001:db8:aaaa:2::5')).not.toBe(net);
    expect(network('2001:db8::1')).toBe(network('2001:db8:0:0:1::'));
  });
});
