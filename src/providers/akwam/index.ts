import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class AkwamProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'akwam';
  name = 'Akwam (أكوام)';
  lang = 'ar';
  mainUrl = 'https://akwam.ss/one';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() { super(); this.initLogger(); }

  private siteOrigin(baseUrl: string): string { return new URL(baseUrl).origin; }
  private siteBase(baseUrl: string): string {
    const parsed = new URL(baseUrl);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return pathname && pathname !== '/' ? `${parsed.origin}${pathname}` : parsed.origin;
  }
  private discoveryUrl(baseUrl: string, path: string): string {
    return `${this.siteBase(baseUrl)}/${path.replace(/^\/+/, '')}`;
  }
  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, `${this.siteOrigin(baseUrl)}/`).toString();
  }

  private parseListing(resp: Awaited<ReturnType<HttpClient['get']>>, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    const anchors = resp.$('.widget-body .entry-box a.box, .widget-body .entry-box a[href], .entry-box a.box, .entry-box a[href]');
    anchors.each((_, el) => {
      const href = resp.$(el).attr('href');
      if (!href) return;
      const absolute = this.fixUrl(href, baseUrl);
      if (seen.has(absolute)) return;
      const entry = resp.$(el).closest('.entry-box');
      const title = (entry.find('.entry-title').first().text() || resp.$(el).attr('title') || resp.$(el).text()).trim();
      if (!title || absolute === this.siteBase(baseUrl) || absolute.endsWith('/')) return;
      const image = entry.find('img').first();
      const poster = this.fixUrl(image.attr('data-src') || image.attr('src'), baseUrl);
      const type: StremioContentType = forcedType || (/\/series(?:\/|$)/i.test(absolute) ? 'series' : 'movie');
      const yearMatch = entry.text().match(/\b(19\d\d|20\d\d)\b/);
      seen.add(absolute);
      items.push({ id: this.formatId(absolute), provider: this.name, type, title, poster, year: yearMatch ? parseInt(yearMatch[1], 10) : undefined, url: absolute });
    });
    return items;
  }

  private async withContentDomain<T>(contentId: string, attempt: (baseUrl: string, fullUrl: string) => Promise<T>): Promise<T> {
    if (/^https?:\/\//i.test(contentId)) {
      const parsed = new URL(contentId);
      return attempt(parsed.origin, contentId);
    }
    return this.withHealthyDomain(async (baseUrl) => {
      const value = await attempt(baseUrl, this.fixUrl(contentId, baseUrl));
      return { value, identityVerified: value !== null && (!Array.isArray(value) || value.length > 0) };
    });
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const items: ProviderItem[] = [];
      for (const section of ['movie', 'series'] as const) {
        const resp = await this.http.get(this.discoveryUrl(baseUrl, `search?q=${encodeURIComponent(query)}&section=${section}`), { timeout: 30000, retries: 2, retryDelayMs: 500 });
        items.push(...this.parseListing(resp, baseUrl, section));
      }
      const unique = [...new Map(items.map((item) => [item.url || item.id, item])).values()];
      return { value: unique, identityVerified: unique.length > 0 };
    });
  }
  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'series' ? 'series' : 'movies';
      const resp = await this.http.get(this.discoveryUrl(baseUrl, `${path}${page > 1 ? `?page=${page}` : ''}`), { timeout: 30000, retries: 2, retryDelayMs: 500 });
      const items = this.parseListing(resp, baseUrl, type);
      return { value: items, identityVerified: items.length > 0 };
    });
  }
  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    return this.withContentDomain(contentId, async (baseUrl, fullUrl) => {
      const resp = await this.http.get(fullUrl);
      const title = resp.$('h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content')?.trim();
      if (!title) return null;
      const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.picture img').attr('src') || resp.$('img').first().attr('src'), baseUrl);
      const description = resp.$('meta[name="description"]').attr('content') || resp.$('.widget-body p').first().text().trim();
      const episodes: ProviderEpisode[] = [];
      if (type === 'series') {
        const seen = new Set<string>();
        resp.$('div.bg-primary2 h2.font-size-18 a, a[href*="/episode/"], a[href*="/episodes/"], a[href*="/watch/"]').each((idx, el) => {
          const epLink = resp.$(el).attr('href');
          if (!epLink) return;
          const absolute = this.fixUrl(epLink, baseUrl);
          if (seen.has(absolute)) return;
          const epTitle = (resp.$(el).attr('title') || resp.$(el).text() || `حلقة ${idx + 1}`).trim();
          const epNumMatch = epTitle.match(/(?:الحلقة|حلقة|episode|ep)\s*[:#-]?\s*(\d+)/i) || absolute.match(/episode[^/]*\/?(\d+)/i);
          if (!epNumMatch && !/\/episodes?\//i.test(absolute) && !/\/watch\//i.test(absolute)) return;
          seen.add(absolute);
          episodes.push({ id: this.formatId(absolute), title: epTitle, season: 1, episode: epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1, url: absolute, poster });
        });
      }
      return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined };
    });
  }
  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const target = episodeId || contentId;
    return this.withContentDomain(target, async (baseUrl, fullUrl) => {
      const resp = await this.http.get(fullUrl, { referer: fullUrl, timeout: 30000, retries: 1, retryDelayMs: 250 });
      const streams: ResolvedStream[] = [];
      const directLinks = new Set<string>();
      resp.$('a[href*="/link/"], a[href*="/watch/"], a[href*="/download/"], a[href*="/play/"], a[href*="/quality/"]').each((_, el) => {
        const link = resp.$(el).attr('href');
        if (link) directLinks.add(this.fixUrl(link, baseUrl));
      });
      const candidates = [...directLinks].slice(0, 8);
      const resolved = await Promise.all(candidates.map(async (dl) => {
        const found: ResolvedStream[] = [];
        try {
          const dlResp = await this.http.get(dl, { referer: fullUrl, timeout: 10000, retries: 1, retryDelayMs: 250 });
          found.push(...await extractStreams(dl, fullUrl));
          dlResp.$('a[href*=".mp4"], a[href*=".m3u8"], a[href*="/download/"], source[src], video[src]').each((_, a) => {
            const streamUrl = dlResp.$(a).attr('href') || dlResp.$(a).attr('src');
            if (!streamUrl) return;
            const absolute = this.fixUrl(streamUrl, dl);
            found.push({ name: 'Akwam Direct', url: absolute, isM3u8: /\.m3u8(?:$|\?)/i.test(absolute), headers: { Referer: dl } });
          });
        } catch (e) {
          this.logger.debug(`Error fetching Akwam playback page: ${(e as Error).message}`);
        }
        return found;
      }));
      for (const batch of resolved) streams.push(...batch);
      return [...new Map(streams.filter((s) => /^https?:\/\//i.test(s.url)).map((s) => [s.url, s])).values()];
    });
  }
}
