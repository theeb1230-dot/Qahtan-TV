import { extractEarnVids } from './earnvids.js';
import { extractShare4max } from './share4max.js';
import { extractMailru } from './mailru.js';
import { extractVidea } from './videa.js';
import { extractGovid } from './govid.js';
import { http } from '../utils/http.js';
import { unpackAll } from '../utils/packer.js';
import { Logger } from '../utils/logger.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('ExtractorRouter');
const MAX_IFRAME_DEPTH = 2;
const MAX_IFRAMES_PER_PAGE = 6;
const MEDIA_HINT = /(?:m3u8|mp4|mkv|manifest|playlist|stream|source|video|hls|dash|file)/i;

function absoluteHttpUrl(raw: string | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    const resolved = new URL(raw, base);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : null;
  } catch {
    return null;
  }
}

function normalizeEmbeddedUrl(raw: string, base: string): string | null {
  const decoded = raw
    .replace(/\\\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/&amp;/gi, '&')
    .replace(/[),;]+$/, '');
  return absoluteHttpUrl(decoded, base);
}

function isLikelyMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return /\.(?:m3u8|mp4|mkv)(?:$|\?)/i.test(parsed.pathname + parsed.search) || MEDIA_HINT.test(`${parsed.pathname}?${parsed.searchParams.toString()}`);
  } catch {
    return false;
  }
}

function collectEmbeddedMedia(html: string, base: string): string[] {
  const out = new Set<string>();
  const add = (raw: string) => {
    const resolved = normalizeEmbeddedUrl(raw, base);
    if (resolved && isLikelyMediaUrl(resolved)) out.add(resolved);
  };

  const explicitUrls = html.match(/(?:https?:)?\\?\/\\?\/[^'"\\s<>]+/gi) || [];
  for (const raw of explicitUrls) add(raw);

  const keyedValues = html.match(/(?:file|src|source|stream|playlist|manifest|video|hls|dash|url)\\?"?\\s*[:=]\\s*\\?"([^"'\\s<>]+)/gi) || [];
  for (const raw of keyedValues) {
    const value = raw.replace(/^.*?[:=]\s*["']?/i, '');
    add(value);
  }

  return Array.from(out);
}

export async function extractStreams(url: string, referer?: string): Promise<ResolvedStream[]> {
  return extractStreamsInternal(url, referer, 0, new Set<string>());
}

async function extractStreamsInternal(url: string, referer: string | undefined, depth: number, visited: Set<string>): Promise<ResolvedStream[]> {
  if (!url || !url.startsWith('http') || visited.has(url)) return [];
  visited.add(url);

  const lower = url.toLowerCase();

  if (lower.includes('.m3u8') || lower.includes('.mp4') || lower.includes('.mkv')) {
    return [{ name: 'Direct Stream', url, isM3u8: lower.includes('.m3u8'), headers: referer ? { Referer: referer } : undefined }];
  }

  if (lower.includes('govid.live')) {
    const streams = await extractGovid(url, referer);
    if (streams.length > 0) return streams;
  }
  if (lower.includes('earnvids') || lower.includes('streamhg') || lower.includes('fdewsdc') || lower.includes('vidbem')) {
    const streams = await extractEarnVids(url, referer);
    if (streams.length > 0) return streams;
  }
  if (lower.includes('share4max') || lower.includes('megamax') || lower.includes('megabox')) {
    const streams = await extractShare4max(url, referer);
    if (streams.length > 0) return streams;
  }
  if (lower.includes('mail.ru')) {
    const streams = await extractMailru(url, referer);
    if (streams.length > 0) return streams;
  }
  if (lower.includes('videa.hu')) {
    const streams = await extractVidea(url, referer);
    if (streams.length > 0) return streams;
  }

  try {
    const resp = await http.get(url, {
      referer,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    });
    const html = resp.text;
    const streams: ResolvedStream[] = [];

    resp.$('video[src], video source, source').each((_, el) => {
      const src = absoluteHttpUrl(resp.$(el).attr('src'), url);
      if (src) streams.push({ name: 'Video Source', url: src, isM3u8: src.includes('.m3u8'), headers: { Referer: url } });
    });

    for (const mediaUrl of collectEmbeddedMedia(html, url)) {
      streams.push({
        name: mediaUrl.toLowerCase().includes('.m3u8') ? 'Embedded HLS' : 'Embedded Video',
        url: mediaUrl,
        isM3u8: mediaUrl.toLowerCase().includes('.m3u8'),
        headers: { Referer: url },
      });
    }

    if (html.includes('eval(function(p,a,c,k,e,d)')) {
      const unpacked = unpackAll(html, url);
      const mdMatch = unpacked.match(/MDCore\.(?:wurl|wsrc)\s*=\s*["']([^"']+)["']/i);
      if (mdMatch) {
        const fileUrl = absoluteHttpUrl(mdMatch[1], url);
        if (fileUrl) streams.push({ name: 'Mixdrop Direct', url: fileUrl, isM3u8: fileUrl.includes('.m3u8'), headers: { Referer: url } });
      }
      for (const mediaUrl of collectEmbeddedMedia(unpacked, url)) {
        streams.push({ name: 'Unpacked Video', url: mediaUrl, isM3u8: mediaUrl.toLowerCase().includes('.m3u8'), headers: { Referer: url } });
      }
    }

    if (depth < MAX_IFRAME_DEPTH) {
      const iframeUrls: string[] = [];
      resp.$('iframe[src],iframe[data-src]').each((_, el) => {
        if (iframeUrls.length >= MAX_IFRAMES_PER_PAGE) return;
        const iframeUrl = absoluteHttpUrl(resp.$(el).attr('src') || resp.$(el).attr('data-src'), url);
        if (iframeUrl && !visited.has(iframeUrl) && !iframeUrls.includes(iframeUrl)) iframeUrls.push(iframeUrl);
      });
      for (const iframeUrl of iframeUrls) {
        try { streams.push(...await extractStreamsInternal(iframeUrl, url, depth + 1, visited)); }
        catch (error) { logger.debug(`Nested iframe extraction failed for ${iframeUrl}: ${(error as Error).message}`); }
      }
    }

    const uniqueMap = new Map<string, ResolvedStream>();
    for (const stream of streams) {
      if (/^https?:\/\//i.test(stream.url) && !uniqueMap.has(stream.url)) uniqueMap.set(stream.url, stream);
    }
    return Array.from(uniqueMap.values());
  } catch (err) {
    logger.debug(`Generic embed inspection failed for ${url}: ${(err as Error).message}`);
  }

  return [];
}
