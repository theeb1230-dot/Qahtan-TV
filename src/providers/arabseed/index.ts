import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class ArabseedProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'arabseed';
  name = 'Arabseed (عرب سيد)';
  lang = 'ar';
  mainUrl = 'https://arabseeds.watch';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() { super(); this.initLogger(); }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  private originFor(url: string): string {
    try { return new URL(url).origin; } catch { return this.mainUrl; }
  }

  private parseItems(resp: Awaited<ReturnType<HttpClient['get']>>, type?: StremioContentType, baseUrl = this.mainUrl): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    resp.$('a.movie__block, div.MovieBlock, div.PostBlock').each((_, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a').first();
      const title = resp.$(el).find('h3, h4, .BlockItemTitle, .Title').text().trim() || a.attr('title') || '';
      const href = a.attr('href');
      if (!title || !href) return;
      const absolute = this.fixUrl(href, baseUrl);
      if (seen.has(absolute)) return;
      seen.add(absolute);
      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
      const inferred = href.includes('/series/') || title.includes('مسلسل') ? 'series' : 'movie';
      items.push({ id: this.formatId(absolute), provider: this.name, type: type || inferred, title, poster, url: absolute });
    });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const resp = await this.http.get(`${baseUrl}/find/?find=${encodeURIComponent(query)}`);
      const items = this.parseItems(resp, undefined, baseUrl);
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'series' ? 'series' : 'movies';
      const resp = await this.http.get(`${baseUrl}/${path}${page > 1 ? `/page/${page}/` : '/'}`);
      const items = this.parseItems(resp, type, baseUrl);
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const origin = this.originFor(fullUrl);
    const resp = await this.http.get(fullUrl);
    const title = resp.$('h1.Title, h1, h3').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Arabseed Title';
    const poster = this.fixUrl(resp.$('.Poster img, .post__image img').attr('data-src') || resp.$('.Poster img, .post__image img').attr('src') || resp.$('meta[property="og:image"]').attr('content'), origin);
    const description = resp.$('.Story p, .post__info p').text().trim();
    const episodes: ProviderEpisode[] = [];
    if (type === 'series' || fullUrl.includes('/series/')) {
      resp.$('a[href*="-الحلقة-"], a[href*="/episode-"], div.ContainerEpisodesList a').each((idx, el) => {
        const epHref = resp.$(el).attr('href');
        const epTitle = resp.$(el).text().trim() || `حلقة ${idx + 1}`;
        if (!epHref) return;
        const absolute = this.fixUrl(epHref, origin);
        const match = epTitle.match(/(\d+)/);
        episodes.push({ id: this.formatId(absolute), title: epTitle, season: 1, episode: match ? parseInt(match[1], 10) : idx + 1, url: absolute, poster });
      });
    }
    return { id: this.formatId(fullUrl), provider: this.name, type: episodes.length ? 'series' : type, title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const fullUrl = this.fixUrl(episodeId || contentId);
    const origin = this.originFor(fullUrl);
    const resp = await this.http.get(fullUrl);
    const streams: ResolvedStream[] = [];
    const serverLinks = new Set<string>();
    const watchHref = resp.$('a[href*="/watch/"], a.watchBTn').attr('href');
    const watchPageUrl = watchHref ? this.fixUrl(watchHref, origin) : `${fullUrl.replace(/\/$/, '')}/watch/`;
    try {
      const watch = await this.http.get(watchPageUrl, { headers: { Referer: fullUrl } });
      watch.$('.server-item[data-src], ul.serversList li[data-link], [data-embed]').each((_, el) => {
        const link = watch.$(el).attr('data-src') || watch.$(el).attr('data-link') || watch.$(el).attr('data-embed');
        if (link) serverLinks.add(this.fixUrl(link, origin));
      });
      watch.$('iframe').each((_, el) => { const src = watch.$(el).attr('src'); if (src) serverLinks.add(this.fixUrl(src, origin)); });
    } catch (e) { this.logger.debug(`Error loading watch page: ${(e as Error).message}`); }

    const downloadHref = resp.$('a[href*="/download/"]').attr('href');
    if (downloadHref) {
      try {
        const downloadUrl = this.fixUrl(downloadHref, origin);
        const download = await this.http.get(downloadUrl, { headers: { Referer: fullUrl } });
        download.$('a[href*="mixdrop"], a[href*="dood"], a[href*="myvid"]').each((_, a) => {
          const href = download.$(a).attr('href');
          if (href) serverLinks.add(this.fixUrl(href.replace('/d/', '/e/').replace('/f/', '/e/'), origin));
        });
      } catch (e) { this.logger.debug(`Error loading download page: ${(e as Error).message}`); }
    }
    for (const serverUrl of serverLinks) {
      try { streams.push(...await extractStreams(serverUrl, watchPageUrl)); } catch (e) { this.logger.debug(`ArabSeed extractor failed: ${(e as Error).message}`); }
    }
    return streams.filter((stream) => /^https?:\/\//i.test(stream.url));
  }
}
