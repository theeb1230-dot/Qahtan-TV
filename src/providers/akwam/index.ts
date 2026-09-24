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
    if (parsed.hostname === 'akwams.org' || parsed.hostname.endsWith('.akwams.org')) return parsed.origin;
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
    const base = /^\//.test(url) ? `${this.siteOrigin(baseUrl)}/` : `${this.siteBase(baseUrl)}/`;
    return new URL(url, base).toString();
  }

  private isChallenge(resp: Awaited<ReturnType<HttpClient['get']>>): boolean {
    const title = resp.$('title').first().text().trim().toLowerCase();
    const body = resp.$('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
    return /just a moment|cloudflare|verify you are human|attention required/.test(`${title} ${body}`);
  }

  private hasIdentityFingerprint(resp: Awaited<ReturnType<HttpClient['get']>>): boolean {
    if (this.isChallenge(resp)) return false;
    const title = resp.$('title').first().text().trim().toLowerCase();
    const html = resp.text().toLowerCase();
    const body = resp.$('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
    return /akwam|أكوام/.test(`${title} ${html} ${body}`) && (
      resp.$('a[href*="/movie/"], a[href*="/movies/"], a[href*="/series/"], a[href*="/watch/"], a[href*="/episode/"], a[href*="/episodes/"], .entry-box, .film, .movie, article').length > 0
      || /أفلام|مسلسلات|الحلقة|movie|movies|series|episode/.test(body)
    );
  }

  private isContentPath(path: string): boolean {
    let normalized = path.toLowerCase();
    try { normalized = decodeURIComponent(normalized); } catch { /* keep raw path */ }
    if (/^\/category(?:\/|$)/i.test(normalized)) return false;
    if (/^\/(?:movies?|series|films?|tv)\/?$/i.test(normalized)) return false;
    // Pagination/index pages are navigation, not playable content.
    if (/^\/(?:movies?|films?|series|tv)\/page\/\d+\/?$/i.test(normalized)) return false;
    if (/^\/(?:movies?|films?|series|tv)\/(?:page|category)\//i.test(normalized)) return false;
    // Reject obvious listing slugs that have no content identifier segment.
    if (/^\/(?:movies?|films?|series|tv)\/(?:page|category|search|latest|new|all)(?:\/|$)/i.test(normalized)) return false;
    return /(?:\/movie(?:s)?\/|\/series\/|\/watch(?:\.php|\/)|\/episode(?:s)?\/)/i.test(normalized);
  }

  private async verifyIdentity(baseUrl: string): Promise<boolean> {
    try {
      const resp = await this.http.get(baseUrl, { timeout: 15000, retries: 1, retryDelayMs: 250 });
      const verified = this.hasIdentityFingerprint(resp);
      this.logger.debug(`Akwam identity probe ${baseUrl} verified=${verified}`);
      return verified;
    } catch (e) {
      this.logger.debug(`Akwam identity probe failed ${baseUrl}: ${(e as Error).message}`);
      return false;
    }
  }

  private parseListing(resp: Awaited<ReturnType<HttpClient['get']>>, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    const selector = [
      '.widget-body .entry-box a.box', '.widget-body .entry-box a[href]', '.entry-box a.box', '.entry-box a[href]',
      'article a[href]', '.post a[href]', '.movie a[href]', '.film a[href]', '.film-poster a[href]',
      '.post-item a[href]', '.card a[href]', '.item a[href]', 'a[href*="/movie/"]', 'a[href*="/movies/"]',
      'a[href*="/series/"]', 'a[href*="/watch/"]', 'a[href*="/episode/"]', 'a[href*="/episodes/"]',
      'a[href*="movie"]', 'a[href*="movies"]', 'a[href*="series"]', 'a[href*="watch"]', 'a[href*="episode"]',
    ].join(', ');
    resp.$(selector).each((idx, el) => {
      const href = resp.$(el).attr('href');
      if (!href) return;
      const absolute = this.fixUrl(href, baseUrl);
      let path = '';
      try { path = new URL(absolute).pathname.toLowerCase(); } catch { return; }
      if (!this.isContentPath(path) || seen.has(absolute)) return;
      const entry = resp.$(el).closest('.entry-box, article, .post, .movie, .film, .film-poster, .post-item, li, .card, .item');
      const title = (entry.find('.entry-title, .title, h1, h2, h3, h4').first().text() || resp.$(el).attr('title') || resp.$(el).attr('aria-label') || resp.$(el).text() || `Akwam ${idx + 1}`).replace(/\s+/g, ' ').trim();
      if (title.length < 2) return;
      const image = entry.find('img').first();
      const poster = this.fixUrl(image.attr('data-src') || image.attr('data-lazy-src') || image.attr('src'), baseUrl);
      const type: StremioContentType = forcedType || (/\/(?:series|episode|episodes)\b/i.test(path) ? 'series' : 'movie');
      const yearMatch = entry.text().match(/\b(19\d\d|20\d\d)\b/);
      seen.add(absolute);
      items.push({ id: this.formatId(absolute), provider: this.name, type, title, poster, year: yearMatch ? parseInt(yearMatch[1], 10) : undefined, url: absolute });
    });
    if (items.length === 0 && this.hasIdentityFingerprint(resp)) {
      resp.$('a[href]').each((idx, el) => {
        const href = resp.$(el).attr('href');
        if (!href) return;
        const absolute = this.fixUrl(href, baseUrl);
        let path = '';
        try { path = new URL(absolute).pathname.toLowerCase(); } catch { return; }
        if (!this.isContentPath(path) || seen.has(absolute)) return;
        const title = (resp.$(el).attr('title') || resp.$(el).attr('aria-label') || resp.$(el).text() || `Akwam ${idx + 1}`).replace(/\s+/g, ' ').trim();
        if (title.length < 2) return;
        seen.add(absolute);
        items.push({ id: this.formatId(absolute), provider: this.name, type: forcedType || (/\/series\//i.test(path) ? 'series' : 'movie'), title, poster: '', url: absolute });
      });
    }
    return items;
  }

  private async fetchFirstListing(baseUrl: string, urls: string[], forcedType?: StremioContentType): Promise<ProviderItem[]> {
    const queue = [...urls.slice(0, 8)];
    const results: ProviderItem[] = [];
    const seen = new Set<string>();
    const worker = async () => {
      while (queue.length > 0 && results.length === 0) {
        const url = queue.shift();
        if (!url) return;
        try {
          const resp = await this.http.get(url, { timeout: 30000, retries: 1, retryDelayMs: 500 });
          const parsed = this.parseListing(resp, baseUrl, forcedType);
          if (parsed.length > 0) {
            for (const item of parsed) {
              const key = item.url || item.id;
              if (!seen.has(key)) { seen.add(key); results.push(item); }
            }
            return;
          }
        } catch (e) {
          this.logger.debug(`Akwam listing candidate failed: ${url} ${(e as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, Math.max(1, queue.length)) }, () => worker()));
    return results;
  }

  private async withContentDomain<T>(contentId: string, attempt: (baseUrl: string, fullUrl: string) => Promise<T>): Promise<T> {
    if (/^https?:\/\//i.test(contentId)) {
      const parsed = new URL(contentId);
      return attempt(parsed.origin, contentId);
    }
    return this.withHealthyDomain(async (baseUrl) => {
      const value = await attempt(baseUrl, this.fixUrl(contentId, baseUrl));
      return { value, identityVerified: value !== null };
    });
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const encoded = encodeURIComponent(query);
      const identityVerified = await this.verifyIdentity(baseUrl);
      const items: ProviderItem[] = [];
      const urls = [
        this.discoveryUrl(baseUrl, `search?q=${encoded}`),
        this.discoveryUrl(baseUrl, `search?query=${encoded}`),
        this.discoveryUrl(baseUrl, `search?keyword=${encoded}`),
        this.discoveryUrl(baseUrl, `search/${encoded}`),
        this.discoveryUrl(baseUrl, `?s=${encoded}`),
      ];
      for (const section of ['movie', 'series'] as const) {
        items.push(...await this.fetchFirstListing(baseUrl, urls.map((url) => `${url}${url.includes('?') ? '&' : '?'}section=${section}`), section));
      }
      const unique = [...new Map(items.map((item) => [item.url || item.id, item])).values()];
      return { value: unique, identityVerified };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const identityVerified = await this.verifyIdentity(baseUrl);
      const suffix = page > 1 ? `?page=${page}` : '';
      const paths = type === 'series' ? [`series${suffix}`, `tv${suffix}`, `series-list${suffix}`] : [`movies${suffix}`, `movie${suffix}`, `films${suffix}`];
      const items = await this.fetchFirstListing(baseUrl, paths.map((path) => this.discoveryUrl(baseUrl, path)), type);
      return { value: items, identityVerified };
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
      const directLinks = new Set<string>();
      resp.$('a[href*="/link/"], a[href*="/watch/"], a[href*="/download/"], a[href*="/play/"], a[href*="/quality/"], a[href*="/stream/"]').each((_, el) => {
        const link = resp.$(el).attr('href');
        if (link) directLinks.add(this.fixUrl(link, baseUrl));
      });
      const resolved = await Promise.all([...directLinks].slice(0, 8).map(async (dl) => {
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
      const streams = resolved.flat().filter((s) => /^https?:\/\//i.test(s.url));
      return [...new Map(streams.map((s) => [s.url, s])).values()];
    });
  }
}
