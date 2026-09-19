import * as cheerio from 'cheerio';
import { Logger } from './logger.js';

const logger = new Logger('HttpClient');

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  referer?: string;
  cookies?: string;
  timeout?: number;
  body?: any;
  method?: 'GET' | 'POST' | 'HEAD';
  form?: Record<string, string>;
  redirect?: 'follow' | 'manual' | 'error';
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  text: string;
  json: () => T;
  $: cheerio.CheerioAPI;
}

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export class HttpClient {
  private defaultHeaders: Record<string, string>;
  private cookieJar: Array<{ name: string; value: string; domain: string; path: string; expiresAt?: number; secure: boolean; hostOnly: boolean }> = [];

  constructor(defaultHeaders: Record<string, string> = {}) {
    this.defaultHeaders = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      ...defaultHeaders,
    };
  }

  setCookie(key: string, value: string, url = 'https://localhost/') {
    const target = new URL(url);
    this.storeCookie(key, value, target.hostname, '/', undefined, target.protocol === 'https:', true);
  }

  getCookieString(url = 'https://localhost/'): string {
    const target = new URL(url);
    const now = Date.now();
    this.cookieJar = this.cookieJar.filter((cookie) => !cookie.expiresAt || cookie.expiresAt > now);
    return this.cookieJar
      .filter((cookie) => {
        const domainMatch = cookie.hostOnly
          ? target.hostname === cookie.domain
          : target.hostname === cookie.domain || target.hostname.endsWith(`.${cookie.domain}`);
        const pathMatch = target.pathname.startsWith(cookie.path);
        const secureMatch = !cookie.secure || target.protocol === 'https:';
        return domainMatch && pathMatch && secureMatch;
      })
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  private storeCookie(name: string, value: string, domain: string, path: string, expiresAt?: number, secure = false, hostOnly = true) {
    const normalizedDomain = domain.toLowerCase().replace(/^\\./, '');
    this.cookieJar = this.cookieJar.filter((cookie) =>
      !(cookie.name === name && cookie.domain === normalizedDomain && cookie.path === path)
    );
    if (expiresAt && expiresAt <= Date.now()) return;
    this.cookieJar.push({ name, value, domain: normalizedDomain, path, expiresAt, secure, hostOnly });
  }

  private captureSetCookie(raw: string, responseUrl: string) {
    const target = new URL(responseUrl);
    const parts = raw.split(';').map((part) => part.trim());
    const first = parts.shift();
    if (!first) return;
    const separator = first.indexOf('=');
    if (separator <= 0) return;
    const name = first.slice(0, separator).trim();
    const value = first.slice(separator + 1).trim();
    let domain = target.hostname;
    let path = '/';
    let expiresAt: number | undefined;
    let secure = false;
    let hostOnly = true;
    for (const attr of parts) {
      const [rawKey, ...rest] = attr.split('=');
      const key = rawKey.toLowerCase();
      const attrValue = rest.join('=').trim();
      if (key === 'domain' && attrValue) {
        const candidate = attrValue.toLowerCase().replace(/^\\./, '');
        if (target.hostname !== candidate && !target.hostname.endsWith(`.${candidate}`)) return;
        domain = candidate;
        hostOnly = false;
      } else if (key === 'path' && attrValue.startsWith('/')) path = attrValue;
      else if (key === 'expires' && attrValue) {
        const parsed = Date.parse(attrValue);
        if (!Number.isNaN(parsed)) expiresAt = parsed;
      } else if (key === 'max-age' && attrValue) {
        const seconds = Number(attrValue);
        if (Number.isFinite(seconds)) expiresAt = Date.now() + seconds * 1000;
      } else if (key === 'secure') secure = true;
    }
    this.storeCookie(name, value, domain, path, expiresAt, secure, hostOnly);
  }

  async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeout = options.timeout || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers || {}),
    };

    if (options.referer) {
      headers['Referer'] = options.referer;
    }

    const cookieHeader = [this.getCookieString(url), options.cookies].filter(Boolean).join('; ');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    let body: BodyInit | undefined = undefined;
    const method = options.method || (options.form || options.body ? 'POST' : 'GET');

    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.form)) {
        searchParams.append(key, value);
      }
      body = searchParams.toString();
    } else if (options.body) {
      if (typeof options.body === 'object' && !(options.body instanceof String)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = JSON.stringify(options.body);
      } else {
        body = String(options.body);
      }
    }

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body,
        redirect: options.redirect || 'follow',
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      resp.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });

      // Track set-cookie
      const setCookies = typeof resp.headers.getSetCookie === 'function'
        ? resp.headers.getSetCookie()
        : [resp.headers.get('set-cookie')].filter((value): value is string => Boolean(value));
      for (const setCookie of setCookies) this.captureSetCookie(setCookie, resp.url);

      const text = await resp.text();

      return {
        status: resp.status,
        statusText: resp.statusText,
        url: resp.url,
        headers: responseHeaders,
        text,
        json: () => {
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error(`Failed to parse JSON response: ${(e as Error).message}`);
          }
        },
        $: cheerio.load(text),
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T = any>(url: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST' });
  }
}

export const http = new HttpClient();
