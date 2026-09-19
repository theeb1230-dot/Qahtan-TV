import { assertSafePublicUrl, isForbiddenIp } from '../security/network.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejected(url: string) {
  let rejected = false;
  try {
    await assertSafePublicUrl(url);
  } catch {
    rejected = true;
  }
  assert(rejected, `Expected unsafe URL to be rejected: ${url}`);
}

export async function runNetworkSecurityTests() {
  assert(isForbiddenIp('127.0.0.1'), 'loopback IPv4 must be forbidden');
  assert(isForbiddenIp('10.0.0.1'), 'RFC1918 IPv4 must be forbidden');
  assert(isForbiddenIp('169.254.169.254'), 'link-local metadata IPv4 must be forbidden');
  assert(isForbiddenIp('100.64.0.1'), 'carrier-grade NAT IPv4 must be forbidden');
  assert(isForbiddenIp('::1'), 'IPv6 loopback must be forbidden');
  assert(isForbiddenIp('fc00::1'), 'IPv6 unique-local must be forbidden');
  assert(isForbiddenIp('fe80::1'), 'IPv6 link-local must be forbidden');
  assert(isForbiddenIp('::ffff:127.0.0.1'), 'IPv4-mapped IPv6 loopback must be forbidden');
  assert(!isForbiddenIp('1.1.1.1'), 'known public IPv4 should not be classified as private');
  assert(!isForbiddenIp('2606:4700:4700::1111'), 'known public IPv6 should not be classified as private');

  await assertRejected('file:///etc/passwd');
  await assertRejected('http://localhost/');
  await assertRejected('http://service.local/');
  await assertRejected('http://127.0.0.1/');
  await assertRejected('http://169.254.169.254/latest/meta-data/');
  await assertRejected('http://user:pass@example.com/');

  console.log('Network security contract tests passed');
}
