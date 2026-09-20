import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class WecimaProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'wecima';
  name = 'We Cima (وي سيما)';
  lang = 'ar';
  mainUrl = 'https://wecima.cx';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  private contentOrigin(contentId: string): string {
    try { return new URL(contentId).origin; } catch { return this.mainUrl; }
  }

  private parseItems(resp: Awaited<ReturnType<HttpClient['get']>>, baseUrl: string): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    resp.$('a[href]').each((_, a) => {
      const href = resp.$(a).attr('href') || '';
      if (!/\/(watch|series)\//i.test(href)) return;
      const title = (resp.$(a).attr('title') || resp.$(a).find('img').attr('alt') || resp.$(a).text()).trim();
      if (!title || title.length < 3) return;
      const absoluteUrl = this.fixUrl(href, baseUrl);
      if (seen.has(absoluteUrl)) return;
      seen.add(absoluteUrl);
      const isSeries = /\/series\//i.test(href) || /مسلسل|حلقة|موسم/.test(title);
      items.push({
        id: this.formatId(absoluteUrl), provider: this.name, type: isSeries ? 'series' : 'movie', title,
        poster: this.fixUrl(resp.$(a).find('img').attr('src') || resp.$(a).find('img').attr('data-src'), baseUrl), url: absoluteUrl,
      });
    });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const candidates = [`${baseUrl}/?s=${encodeURIComponent(query)}`, `${baseUrl}/search.php?keywords=${encodeURIComponent(query)}`];
      for (const url of candidates) {
        try {
          const resp = await this.http.get(url);
          const items = this.parseItems(resp, baseUrl);
          if (items.length) return { value: items, identityVerified: true };
        } catch { /* try compatible fallback */ }
      }
      return { value: [], identityVerified: false };
    });
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const modern = page > 1 ? `${baseUrl}/page/${page}/` : `${baseUrl}/`;
      const legacy = type === 'series' ? `${baseUrl}/episodes.php${page > 1 ? `?page=${page}` : ''}` : `${baseUrl}/movies.php${page > 1 ? `?page=${page}` : ''}`;
      for (const url of [modern, legacy]) {
        try {
          const resp = await this.http.get(url);
          const items = this.parseItems(resp, baseUrl).filter((item) => item.type === type);
          if (items.length) return { value: items, identityVerified: true };
        } catch { /* try compatible fallback */ }
      }
      return { value: [], identityVerified: false };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const origin = this.contentOrigin(contentId);
    const fullUrl = this.fixUrl(contentId, origin);
    const resp = await this.http.get(fullUrl);
    const title = resp.$('h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || resp.$('title').text().trim();
    if (!title) return null;
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.video-bibplayer-poster').css('background-image')?.replace(/url\(['"]?(.*?)['"]?\)/, '$1'), origin);
    const description = resp.$('meta[property="og:description"]').attr('content') || resp.$('.video-description').text().trim();
    const episodes = type === 'series' ? this.parseItems(resp, origin)
      .filter((item) => item.type === 'series' || /حلقة|episode/i.test(item.title))
      .map((item, index) => ({ id: item.id, title: item.title, season: 1, episode: index + 1 })) : undefined;
    return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl, episodes };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetId = episodeId || contentId;
    const normalized = targetId.startsWith(`${this.id}:`) ? targetId.slice(this.id.length + 1) : targetId;
    const origin = this.contentOrigin(normalized);
    const fullUrl = this.fixUrl(normalized, origin);
    const streams: ResolvedStream[] = [];
    const vidMatch = fullUrl.match(/vid=([a-zA-Z0-9]+)/);
    const playUrl = vidMatch ? `${origin}/play.php?vid=${vidMatch[1]}` : fullUrl;
    try {
      const playRes = await this.http.get(playUrl, { headers: { Referer: fullUrl } });
      const iframes: string[] = [];
      playRes.$('iframe').each((_, ifr) => { const src = playRes.$(ifr).attr('src'); if (src) iframes.push(this.fixUrl(src, origin)); });
      for (const iframeUrl of iframes) streams.push(...await extractStreams(iframeUrl, playUrl));
    } catch (e) {
      this.logger.debug(`Error getting WeCima streams: ${(e as Error).message}`);
    }
    return streams.filter((stream) => /^https?:\/\//i.test(stream.url));
  }
}
