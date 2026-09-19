import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

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

interface SafeDestination {
  url: URL;
  address: string;
  family: 4 | 6;
}

export async function resolveSafePublicUrl(raw: string): Promise<SafeDestination> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are allowed');
  if (url.username || url.password) throw new Error('URL credentials are not allowed');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Local destinations are blocked');
  }
  if (net.isIP(host)) {
    if (isForbiddenIp(host)) throw new Error('Private or reserved destination is blocked');
    return { url, address: host, family: net.isIPv4(host) ? 4 : 6 };
  }
  const resolved = await dns.promises.lookup(host, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(r => isForbiddenIp(r.address))) {
    throw new Error('Private or reserved destination is blocked');
  }
  const selected = resolved[0];
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  return (await resolveSafePublicUrl(raw)).url;
}

function fetchPinned(destination: SafeDestination, init: RequestInit): Promise<globalThis.Response> {
  return new Promise((resolve, reject) => {
    const { url, address, family } = destination;
    const headers = new Headers(init.headers);
    if (!headers.has('host')) headers.set('host', url.host);
    const requestModule = url.protocol === 'https:' ? https : http;
    const request = requestModule.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: init.method || 'GET',
      headers: Object.fromEntries(headers.entries()),
      servername: url.protocol === 'https:' ? url.hostname : undefined,
      lookup: (_hostname, options, callback) => {
        const opts = typeof options === 'object' ? options : {};
        if ((opts as dns.LookupAllOptions).all) callback(null, [{ address, family }] as any);
        else callback(null, address, family);
      },
      signal: init.signal as AbortSignal | undefined,
    }, (upstream) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(upstream.headers)) {
        if (Array.isArray(value)) value.forEach(v => responseHeaders.append(name, v));
        else if (value !== undefined) responseHeaders.set(name, String(value));
      }
      const body = Readable.toWeb(upstream) as ReadableStream<Uint8Array>;
      resolve(new Response(body, { status: upstream.statusCode || 502, statusText: upstream.statusMessage, headers: responseHeaders }));
    });
    request.on('error', reject);
    if (init.body) {
      if (typeof init.body === 'string' || init.body instanceof Uint8Array) request.write(init.body);
      else return request.destroy(new Error('Unsupported request body for safe fetch'));
    }
    request.end();
  });
}

export async function safeFetch(raw: string, init: RequestInit, maxRedirects = 3): Promise<globalThis.Response> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    const destination = await resolveSafePublicUrl(current);
    const response = await fetchPinned(destination, init);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    response.body?.cancel().catch(() => undefined);
    if (i === maxRedirects) throw new Error('Too many redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect missing location');
    current = new URL(location, destination.url).toString();
  }
  throw new Error('Redirect validation failed');
}
