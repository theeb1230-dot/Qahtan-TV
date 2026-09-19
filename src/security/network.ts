import dns from 'node:dns';
import net from 'node:net';

export function isForbiddenIp(address: string): boolean {
  const ip = address.toLowerCase().split('%')[0];
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
      p[0] >= 224;
  }
  if (net.isIPv6(ip)) {
    if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') ||
        ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') ||
        ip.startsWith('ff')) return true;
    if (ip.startsWith('::ffff:')) return isForbiddenIp(ip.slice(7));
    return false;
  }
  return true;
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are allowed');
  if (url.username || url.password) throw new Error('URL credentials are not allowed');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Local destinations are blocked');
  }
  if (net.isIP(host) && isForbiddenIp(host)) throw new Error('Private or reserved destination is blocked');
  const resolved = await dns.promises.lookup(host, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(r => isForbiddenIp(r.address))) {
    throw new Error('Private or reserved destination is blocked');
  }
  return url;
}

export async function safeFetch(raw: string, init: RequestInit, maxRedirects = 3): Promise<globalThis.Response> {
  let current = (await assertSafePublicUrl(raw)).toString();
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafePublicUrl(current);
    const response = await fetch(current, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (i === maxRedirects) throw new Error('Too many redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect missing location');
    current = new URL(location, current).toString();
  }
  throw new Error('Redirect validation failed');
}
