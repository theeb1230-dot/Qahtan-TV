import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class EgydeadProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'egydead';
  name = 'Egydead (إيجي ديد)';
  lang = 'ar';
  mainUrl = 'https://tv10.egydead.live/h3/';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    try { return new URL(url, baseUrl).toString(); } catch { return ''; }
  }

  private contentBase(contentId: string): string {
    if (!contentId.startsWith('http')) return this.mainUrl;
    try {
      const parsed = new URL(contentId);
      const registryBase = new URL(this.mainUrl);
      return parsed.origin === registryBase.origin ? `${parsed.origin}${registryBase.pathname}` : `${parsed.origin}/`;
    } catch { return this.mainUrl; }
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const url = this.fixUrl(`?s=${encodeURIComponent(query)}`, baseUrl);
      const resp = await this.http.get(url, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      const items: ProviderItem[] = [];
      resp.$('div.MovieBlock, div.PostBlock, div.moviesList div.item').each((_, el) => {
        const a = resp.$(el).find('a').first();
        const title = resp.$(el).find('.Title, h2, h3').text().trim() || a.attr('title') || '';
        const href = a.attr('href');
        if (!title || !href) return;
        const absoluteUrl = this.fixUrl(href, baseUrl);
        if (!absoluteUrl) return;
        const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
        const isSeries = absoluteUrl.includes('/series/') || title.includes('مسلسل');
        items.push({ id: this.formatId(absoluteUrl), provider: this.name, type: isSeries ? 'series' : 'movie', title, poster, url: absoluteUrl });
      });
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'series' ? 'category/series' : 'category/movies';
      const url = this.fixUrl(`${path}/page/${page}`, baseUrl);
      const resp = await this.http.get(url, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      const items: ProviderItem[] = [];
      resp.$('div.MovieBlock, div.PostBlock, div.moviesList div.item').each((_, el) => {
        const a = resp.$(el).find('a').first();
        const title = resp.$(el).find('.Title, h2, h3').text().trim() || a.attr('title') || '';
        const href = a.attr('href');
        if (!title || !href) return;
        const absoluteUrl = this.fixUrl(href, baseUrl);
        if (!absoluteUrl) return;
        const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
        items.push({ id: this.formatId(absoluteUrl), provider: this.name, type, title, poster, url: absoluteUrl });
      });
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const baseUrl = this.contentBase(contentId);
    const fullUrl = this.fixUrl(contentId, baseUrl);
    if (!fullUrl) return null;
    const resp = await this.http.get(fullUrl, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
    const title = resp.$('h1.Title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Egydead Title';
    const poster = this.fixUrl(resp.$('.Poster img').attr('data-src') || resp.$('.Poster img').attr('src'), fullUrl);
    const description = resp.$('.Story p, .desc').text().trim();
    const episodes: ProviderEpisode[] = [];
    if (type === 'series' || fullUrl.includes('/series/')) {
      resp.$('.episodes-list a, .seasons-list a').each((idx, el) => {
        const epHref = resp.$(el).attr('href');
        const epTitle = resp.$(el).text().trim() || `حلقة ${idx + 1}`;
        if (!epHref) return;
        const absoluteEpisodeUrl = this.fixUrl(epHref, fullUrl);
        if (!absoluteEpisodeUrl) return;
        const epNumMatch = epTitle.match(/(\d+)/);
        episodes.push({ id: this.formatId(absoluteEpisodeUrl), title: epTitle, season: 1, episode: epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1, url: absoluteEpisodeUrl, poster });
      });
    }
    return { id: this.formatId(fullUrl), provider: this.name, type: episodes.length > 0 ? 'series' : 'movie', title, poster, description, url: fullUrl, episodes: episodes.length > 0 ? episodes : undefined };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetPath = episodeId || contentId;
    const baseUrl = this.contentBase(targetPath.startsWith('http') ? targetPath : contentId);
    const fullUrl = this.fixUrl(targetPath, baseUrl);
    if (!fullUrl) return [];
    const streams: ResolvedStream[] = [];
    try {
      const watchUrl = new URL(fullUrl);
      watchUrl.searchParams.set('view', 'watch');
      const resp = await this.http.post(watchUrl.toString(), {
        form: { View: '1' },
        headers: { 'User-Agent': MOBILE_USER_AGENT, Referer: fullUrl, 'X-Requested-With': 'XMLHttpRequest' },
      });
      const serverLinks: string[] = [];
      resp.$('ul.serversList li [data-link], button[data-link]').each((_, el) => {
        const link = resp.$(el).attr('data-link');
        const absolute = this.fixUrl(link, watchUrl.toString());
        if (absolute) serverLinks.push(absolute);
      });
      resp.$('ul.donwload-servers-list li a.ser-link').each((_, el) => {
        const link = resp.$(el).attr('href');
        const absolute = this.fixUrl(link, watchUrl.toString());
        if (absolute) serverLinks.push(absolute);
      });
      for (const link of [...new Set(serverLinks)]) {
        const extracted = await extractStreams(link, watchUrl.toString());
        streams.push(...extracted.filter((stream) => /^https?:\/\//i.test(stream.url)));
      }
    } catch (e) {
      this.logger.warn(`Egydead link extraction encountered notice: ${(e as Error).message}`);
    }
    return streams.filter((stream) => /^https?:\/\//i.test(stream.url));
  }
}
