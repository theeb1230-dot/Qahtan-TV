import vm from 'node:vm';
import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class FaselhdProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'faselhd';
  name = 'FaselHD (فاصل إعلاني)';
  lang = 'ar';
  mainUrl = 'https://www.fasel-hd.co';
  supportedTypes: StremioContentType[] = ['movie', 'series', 'anime'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return '';
    }
  }

  private effectiveOrigin(url: string | undefined, fallback: string): string {
    try {
      return new URL(url || fallback).origin;
    } catch {
      return fallback.replace(/\/$/, '');
    }
  }

  private brandVerified($: any): boolean {
    const title = $('title').text().toLowerCase();
    const siteName = $('meta[property="og:site_name"]').attr('content')?.toLowerCase() || '';
    return title.includes('fasel') || title.includes('فاصل') || siteName.includes('fasel') || siteName.includes('فاصل');
  }

  private parserContractVerified($: any): boolean {
    return $('a[href*="/video/"],a[href*="/watch/"],a[href*="/series/"],a[href*="/movie/"],a[href*="/post/"],a[href*="watch.php?"],iframe,script').length > 0;
  }

  private identityVerified($: any): boolean {
    return this.brandVerified($) && this.parserContractVerified($);
  }

  private detailIdentityVerified(response: any, origin: string): boolean {
    const host = new URL(origin).hostname;
    const canonicalHost = /(^|\.)fasel-hd\.(co|com)$|(^|\.)fasellhd\.(rest|baby)$/.test(host);
    if (!canonicalHost || response.status < 200 || response.status >= 400) return false;
    const parser = this.parserContractVerified(response.$);
    const hasDetailMarkers = response.$('h1,h2,meta[property="og:title"],meta[property="og:image"],article,video,iframe,a[href*="watch.php"],a[href*="/episode/"]').length > 0;
    return parser && hasDetailMarkers;
  }

  private parseItems($: any, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const out: ProviderItem[] = [];
    const seen = new Set<string>();

    const push = (href?: string, title?: string, poster?: string) => {
      if (!href || !title) return;
      const url = this.fixUrl(href, baseUrl);
      if (!url || seen.has(url)) return;
      seen.add(url);
      const type = forcedType || (/series|episode|مسلسل|حلقة/i.test(`${url} ${title}`) ? 'series' : 'movie');
      out.push({
        id: this.formatId(url.replace(baseUrl, '')),
        provider: this.name,
        type,
        title: title.trim(),
        poster: this.fixUrl(poster, baseUrl),
        url,
      });
    };

    $('div.postDiv,article,.post,.item,.post-item').each((_: number, el: any) => {
      const anchor = $(el).find('a').first();
      const image = $(el).find('img').first();
      push(
        anchor.attr('href'),
        $(el).find('h1,h2,h3,.post-title,.title').first().text().trim() || anchor.attr('title') || image.attr('alt') || anchor.text().trim(),
        image.attr('data-src') || image.attr('src'),
      );
    });

    $('a[href*="/video/"],a[href*="/watch/"],a[href*="/series/"],a[href*="/movie/"],a[href*="/post/"],a[href*="watch.php?"]').each((_: number, el: any) => {
      const anchor = $(el);
      const image = anchor.find('img').first();
      push(anchor.attr('href'), anchor.attr('title') || image.attr('alt') || anchor.text().trim(), image.attr('data-src') || image.attr('src'));
    });

    return out;
  }

  private async verifyCanonicalDomain(baseUrl: string): Promise<boolean> {
    try {
      const allowed = new Set(['www.fasel-hd.co', 'fasel-hd.co', 'www.fasel-hd.com', 'fasel-hd.com', 'fasellhd.rest', 'fasellhd.baby']);
      const host = new URL(baseUrl).hostname;
      if (!allowed.has(host)) return false;
      const response = await this.http.get(`${baseUrl}/`, { headers: { 'User-Agent': MOBILE_USER_AGENT }, timeout: 7000 });
      const origin = this.effectiveOrigin(response.url, baseUrl);
      const brand = this.brandVerified(response.$);
      const parser = this.parserContractVerified(response.$);
      const ok = response.status >= 200 && response.status < 400 && brand && parser;
      this.logger.debug(`FaselHD identity landing status=${response.status} finalHost=${new URL(origin).hostname} brand=${brand} parserContract=${parser} bytes=${response.text.length}`);
      return ok;
    } catch {
      return false;
    }
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (base) => {
      if (!(await this.verifyCanonicalDomain(base))) return { value: [], identityVerified: false };
      const response = await this.http.get(`${base}/?s=${encodeURIComponent(query)}`);
      const origin = this.effectiveOrigin(response.url, base);
      return { value: this.parseItems(response.$, origin), identityVerified: true };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (base) => {
      if (!(await this.verifyCanonicalDomain(base))) return { value: [], identityVerified: false };
      const path = type === 'anime' ? 'anime' : type === 'series' ? 'series' : 'movies';
      const response = await this.http.get(`${base}/${path}${page > 1 ? `/page/${page}` : ''}`);
      const origin = this.effectiveOrigin(response.url, base);
      return { value: this.parseItems(response.$, origin, type), identityVerified: true };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    return this.withHealthyDomain(async (base) => {
      const response = await this.http.get(this.fixUrl(contentId, base));
      const origin = this.effectiveOrigin(response.url, base);
      const title = response.$('h1.title,h1').first().text().trim() || response.$('meta[property="og:title"]').attr('content') || 'FaselHD Title';
      const poster = this.fixUrl(response.$('meta[property="og:image"]').attr('content') || response.$('article img').first().attr('src'), origin);
      const description = response.$('meta[name="description"]').attr('content') || '';
      const episodes: ProviderEpisode[] = [];

      response.$('a[href*="watch.php"],a[href*="/episode/"]').each((index: number, el: any) => {
        const href = response.$(el).attr('href');
        if (!href) return;
        const episodeTitle = response.$(el).text().trim() || `حلقة ${index + 1}`;
        const url = this.fixUrl(href, origin);
        episodes.push({ id: this.formatId(url.replace(origin, '')), title: episodeTitle, season: 1, episode: index + 1, url, poster });
      });

      const url = this.fixUrl(contentId, origin);
      return {
        value: {
          id: this.formatId(url.replace(origin, '')),
          provider: this.name,
          type: episodes.length ? 'series' : type,
          title,
          poster,
          description,
          url,
          episodes: episodes.length ? episodes : undefined,
        },
        identityVerified: this.detailIdentityVerified(response, origin),
      };
    });
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    return this.withHealthyDomain(async (base) => {
      const fullUrl = this.fixUrl(episodeId || contentId, base);
      const response = await this.http.get(fullUrl, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      const origin = this.effectiveOrigin(response.url, base);
      const streams: ResolvedStream[] = [];

      const add = (url: string, name = 'FaselHD Direct', quality = 'Auto', headers: Record<string, string> = {}) => {
        if (!/^https?:\/\//i.test(url)) return;
        if (streams.some((stream) => stream.url === url)) return;
        streams.push({ name, quality, url, isM3u8: /\.m3u8(?:$|\?)/i.test(url), headers });
      };

      const mediaPattern = /https?:\/\/[^"'\s<>]+(?:\.m3u8|\.mp4|\.mkv)(?:\?[^"'\s<>]*)?/gi;
      const collectMedia = (source: any, name: string, referrer: string) => {
        const addCandidate = (value?: string, quality = 'Auto') => {
          if (!value) return;
          const resolved = this.fixUrl(value, referrer);
          if (resolved) add(resolved, name, quality, { Referer: referrer });
        };
        source.$('source[src],video[src],video[data-src],*[data-file],*[data-video],*[data-src]').each((_: number, node: any) => {
          const el = source.$(node);
          addCandidate(el.attr('src') || el.attr('data-src') || el.attr('data-file') || el.attr('data-video'), el.attr('label') || el.attr('data-quality') || 'Auto');
        });
        const html = source.text || '';
        for (const match of html.matchAll(mediaPattern)) addCandidate(match[0]);
      };

      const collectIframesAndLinks = (source: any, pageUrl: string) => {
        const urls: string[] = [];
        source.$('iframe[src],iframe[data-src],a[href],button[data-href],button[onclick],.serversList a,.buttonsList button').each((_: number, element: any) => {
          const raw = source.$(element).attr('href') || source.$(element).attr('data-href') || source.$(element).attr('data-src') || source.$(element).attr('src') || source.$(element).attr('onclick')?.match(/https?:\/\/[^'\"]+/)?.[0];
          const resolved = this.fixUrl(raw, pageUrl);
          if (resolved && !urls.includes(resolved)) urls.push(resolved);
        });
        return urls;
      };

      const scripts = response.$('script').map((_: number, script: any) => response.$(script).text()).get().join('\n');
      for (const match of scripts.matchAll(mediaPattern)) add(match[0], 'FaselHD Script', 'Auto', { Referer: response.url || fullUrl });
      for (const match of response.text.matchAll(mediaPattern)) add(match[0], 'FaselHD HTML', 'Auto', { Referer: response.url || fullUrl });
      collectMedia(response, 'FaselHD Source', response.url || fullUrl);

      const candidatePages = collectIframesAndLinks(response, response.url || fullUrl).slice(0, 10);
      for (const candidateUrl of candidatePages) {
        if (/\.(?:m3u8|mp4|mkv)(?:$|\?)/i.test(candidateUrl)) {
          add(candidateUrl, 'FaselHD Direct', 'Auto', { Referer: response.url || fullUrl });
          continue;
        }
        try {
          const playerResponse = await this.http.get(candidateUrl, { headers: { Referer: response.url || fullUrl, 'User-Agent': MOBILE_USER_AGENT }, timeout: 7000 });
          collectMedia(playerResponse, 'FaselHD Player', candidateUrl);
          const playerScripts = playerResponse.$('script').map((_: number, script: any) => playerResponse.$(script).text()).get().join('\n');
          for (const match of playerScripts.matchAll(mediaPattern)) add(match[0], 'FaselHD Player', 'Auto', { Referer: candidateUrl });

          const context: any = {
            window: {},
            document: { getElementById: () => ({}) },
            navigator: { userAgent: 'Mozilla/5.0' },
            jwplayer: () => ({
              setup: (config: any) => {
                if (config?.file) add(this.fixUrl(config.file, candidateUrl), 'FaselHD JW', '1080p', { Referer: candidateUrl });
                for (const source of config?.sources || []) {
                  if (source?.file) add(this.fixUrl(source.file, candidateUrl), `FaselHD ${source.label || 'Source'}`, source.label || 'Auto', { Referer: candidateUrl });
                }
              },
              on: () => undefined,
            }),
          };
          vm.createContext(context);
          for (const script of playerResponse.$('script').map((_: number, node: any) => playerResponse.$(node).text()).get()) {
            if (!/jwplayer|sources|eval/i.test(script)) continue;
            try {
              vm.runInContext(script, context, { timeout: 2000 });
            } catch {
              // Ignore player scripts that require browser-only APIs.
            }
          }

          const nested = collectIframesAndLinks(playerResponse, candidateUrl).filter((nestedUrl) => nestedUrl !== candidateUrl).slice(0, 4);
          for (const nestedUrl of nested) {
            try {
              const extracted = await extractStreams(nestedUrl, candidateUrl);
              for (const stream of extracted) add(stream.url, stream.name, stream.quality, { ...(stream.headers || {}), Referer: candidateUrl });
            } catch {
              // Continue through bounded server candidates.
            }
          }
        } catch (error) {
          this.logger.debug(`FaselHD player extraction failed: ${(error as Error).message}`);
        }
      }

      return { value: streams, identityVerified: this.detailIdentityVerified(response, origin) };
    });
  }
}
