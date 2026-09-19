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
  mainUrl = 'https://mycima.motorcycles';
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
    try {
      return new URL(contentId).origin;
    } catch {
      return this.mainUrl;
    }
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const resp = await this.http.get(`${baseUrl}/search.php?keywords=${encodeURIComponent(query)}`);
      const items: ProviderItem[] = [];
      const seen = new Set<string>();

      resp.$('a[href*="watch.php"]').each((_, a) => {
        const href = resp.$(a).attr('href');
        const title = resp.$(a).text().trim() || resp.$(a).attr('title') || '';
        if (!title || !href || seen.has(href) || title.length < 3) return;
        seen.add(href);
        const absoluteUrl = this.fixUrl(href, baseUrl);
        items.push({
          id: this.formatId(absoluteUrl),
          provider: this.name,
          type: href.includes('series') || title.includes('مسلسل') ? 'series' : 'movie',
          title,
          poster: this.fixUrl(resp.$(a).find('img').attr('src'), baseUrl),
          url: absoluteUrl,
        });
      });

      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const pageParam = page > 1 ? `?page=${page}` : '';
      const url = type === 'series' ? `${baseUrl}/episodes.php${pageParam}` : `${baseUrl}/movies.php${pageParam}`;
      const resp = await this.http.get(url);
      const items: ProviderItem[] = [];
      const seen = new Set<string>();

      resp.$('a[href*="watch.php"]').each((_, a) => {
        const href = resp.$(a).attr('href');
        const title = resp.$(a).text().trim() || resp.$(a).attr('title') || '';
        if (!title || !href || seen.has(href) || title.includes('.ribon') || title.length < 3) return;
        seen.add(href);
        const absoluteUrl = this.fixUrl(href, baseUrl);
        items.push({
          id: this.formatId(absoluteUrl),
          provider: this.name,
          type,
          title,
          poster: this.fixUrl(resp.$(a).find('img').attr('src'), baseUrl),
          url: absoluteUrl,
        });
      });

      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const origin = this.contentOrigin(contentId);
    const fullUrl = this.fixUrl(contentId, origin);
    const resp = await this.http.get(fullUrl);
    const title = resp.$('h1').first().text().trim() || resp.$('title').text().trim() || 'WeCima Title';
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.video-bibplayer-poster').css('background-image')?.replace(/url\(['"]?(.*?)['"]?\)/, '$1'), origin);
    const description = resp.$('meta[property="og:description"]').attr('content') || resp.$('.video-description').text().trim();
    return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, _episodeId?: string): Promise<ResolvedStream[]> {
    const origin = this.contentOrigin(contentId);
    const fullUrl = this.fixUrl(contentId, origin);
    const streams: ResolvedStream[] = [];
    const vidMatch = fullUrl.match(/vid=([a-zA-Z0-9]+)/);
    const playUrl = vidMatch ? `${origin}/play.php?vid=${vidMatch[1]}` : fullUrl;

    try {
      const playRes = await this.http.get(playUrl, { headers: { Referer: fullUrl } });
      const iframes: string[] = [];
      playRes.$('iframe').each((_, ifr) => {
        const src = playRes.$(ifr).attr('src');
        if (src) iframes.push(this.fixUrl(src, origin));
      });
      for (const iframeUrl of iframes) streams.push(...await extractStreams(iframeUrl, playUrl));
    } catch (e) {
      this.logger.debug(`Error getting WeCima streams: ${(e as Error).message}`);
    }
    return streams.filter((stream) => /^https?:\/\//i.test(stream.url));
  }
}
