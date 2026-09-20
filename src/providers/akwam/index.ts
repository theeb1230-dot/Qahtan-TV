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

  constructor() {
    super();
    this.initLogger();
  }

  private siteRoot(baseUrl: string): string {
    return new URL(baseUrl).origin;
  }

  /** Preserve the configured application prefix (currently /one) for discovery
   * routes. Stripping to origin silently changed /one/search into /search and
   * made a healthy domain look like a provider failure. */
  private discoveryUrl(baseUrl: string, path: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, `${this.siteRoot(baseUrl)}/`).toString();
  }

  private parseListing(resp: Awaited<ReturnType<HttpClient['get']>>, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    resp.$('a[href*="/movie/"], a[href*="/series/"]').each((_, el) => {
      const href = resp.$(el).attr('href');
      if (!href) return;
      const absolute = this.fixUrl(href, baseUrl);
      if (seen.has(absolute)) return;
      const card = resp.$(el).closest('article, .entry-box, .col-lg-auto, .col-md-4, .col-6, li, div');
      const title = (resp.$(el).attr('title') || card.find('h1,h2,h3,h4,.entry-title').first().text() || resp.$(el).text()).trim();
      if (!title) return;
      seen.add(absolute);
      const image = card.find('img').first();
      const poster = this.fixUrl(image.attr('data-src') || image.attr('src'), baseUrl);
      const type: StremioContentType = forcedType || (absolute.includes('/series/') ? 'series' : 'movie');
      const yearMatch = card.text().match(/\b(19\d\d|20\d\d)\b/);
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
      const url = this.discoveryUrl(baseUrl, `search?q=${encodeURIComponent(query)}`);
      const resp = await this.http.get(url);
      const items = this.parseListing(resp, baseUrl);
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'series' ? 'series' : 'movies';
      const url = this.discoveryUrl(baseUrl, `${path}${page > 1 ? `?page=${page}` : ''}`);
      const resp = await this.http.get(url);
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
        resp.$('a[href*="/episode/"], a[href*="/episodes/"], a[href*="/watch/"]').each((idx, el) => {
          const epLink = resp.$(el).attr('href');
          if (!epLink) return;
          const absolute = this.fixUrl(epLink, baseUrl);
          if (seen.has(absolute)) return;
          const epTitle = (resp.$(el).attr('title') || resp.$(el).text() || `حلقة ${idx + 1}`).trim();
          if (!/حلقة|episode/i.test(epTitle) && !/\/episodes?\//i.test(absolute)) return;
          seen.add(absolute);
          const epNumMatch = epTitle.match(/(?:حلقة|episode)\s*[:#-]?\s*(\d+)/i) || absolute.match(/episode[^/]*\/?(\d+)/i);
          const seasonNumMatch = epTitle.match(/(?:موسم|season)\s*(\d+)/i) || fullUrl.match(/season[^/]*\/?(\d+)/i);
          episodes.push({ id: this.formatId(absolute), title: epTitle, season: seasonNumMatch ? parseInt(seasonNumMatch[1], 10) : 1, episode: epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1, url: absolute, poster });
        });
      }
      return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined };
    });
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const target = episodeId || contentId;
    return this.withContentDomain(target, async (baseUrl, fullUrl) => {
      const resp = await this.http.get(fullUrl);
      const streams: ResolvedStream[] = [];
      const directLinks = new Set<string>();
      resp.$('a[href*="/watch/"], a[href*="/download/"], a[href*="/play/"]').each((_, el) => {
        const link = resp.$(el).attr('href');
        if (link) directLinks.add(this.fixUrl(link, baseUrl));
      });
      for (const dl of directLinks) {
        try {
          const dlResp = await this.http.get(dl, { referer: fullUrl });
          streams.push(...await extractStreams(dl, fullUrl));
          dlResp.$('a[href*=".mp4"], a[href*=".m3u8"], source[src], video[src]').each((_, a) => {
            const streamUrl = dlResp.$(a).attr('href') || dlResp.$(a).attr('src');
            if (streamUrl) {
              const absolute = this.fixUrl(streamUrl, dl);
              streams.push({ name: 'Akwam Direct', url: absolute, isM3u8: absolute.includes('.m3u8'), headers: { Referer: dl } });
            }
          });
        } catch (e) {
          this.logger.debug(`Error fetching Akwam playback page: ${(e as Error).message}`);
        }
      }
      return streams.filter(s => /^https?:\/\//i.test(s.url));
    });
  }
}
