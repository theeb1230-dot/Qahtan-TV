import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient, MOBILE_USER_AGENT } from '../../utils/http.js';
import { safeBase64Decode } from '../../utils/crypto.js';
import { extractStreams } from '../../extractors/index.js';

export class Anime4upProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'anime4up';
  name = 'Anime4up (أنمي فور اب)';
  lang = 'ar';
  mainUrl = 'https://w1.anime4up.rest';
  supportedTypes: StremioContentType[] = ['anime', 'series', 'movie'];

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
    resp.$('div.anime-card-container').each((_, el) => {
      const a = resp.$(el).find('.anime-title a');
      const title = a.text().trim();
      const href = a.attr('href');
      if (!title || !href) return;
      const absolute = this.fixUrl(href, baseUrl);
      if (seen.has(absolute)) return;
      seen.add(absolute);
      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
      const inferred: StremioContentType = title.includes('فيلم') || href.includes('/movie/') ? 'movie' : 'anime';
      items.push({ id: this.formatId(absolute), provider: this.name, type: type || inferred, title, poster, url: absolute });
    });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const resp = await this.http.get(`${baseUrl}/?search_string=${encodeURIComponent(query)}`, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      const items = this.parseItems(resp, undefined, baseUrl);
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'movie' ? 'anime-type/movie' : 'anime-season';
      const resp = await this.http.get(`${baseUrl}/${path}/page/${page}/`, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      const items = this.parseItems(resp, type, baseUrl);
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const origin = this.originFor(fullUrl);
    const resp = await this.http.get(fullUrl, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
    const title = resp.$('h1.anime-details-title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Anime Title';
    const poster = this.fixUrl(resp.$('.anime-thumbnail img').attr('src') || resp.$('meta[property="og:image"]').attr('content'), origin);
    const description = resp.$('p.anime-story').text().trim();
    const episodes: ProviderEpisode[] = [];
    resp.$('div.episodes-card-container, div.DivEpisodesContainer a').each((idx, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a');
      const epHref = a.attr('href');
      const epTitle = a.text().trim() || `الحلقة ${idx + 1}`;
      if (!epHref) return;
      const epNumMatch = epTitle.match(/(\d+)/);
      const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1;
      const absolute = this.fixUrl(epHref, origin);
      episodes.push({ id: this.formatId(absolute), title: epTitle, season: 1, episode: epNum, url: absolute, poster });
    });
    return { id: this.formatId(fullUrl), provider: this.name, type: type === 'movie' ? 'movie' : 'anime', title, poster, description, url: fullUrl, episodes: episodes.length > 0 ? episodes : undefined };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetPath = episodeId || contentId;
    const fullUrl = this.fixUrl(targetPath);
    const resp = await this.http.get(fullUrl, { headers: { 'User-Agent': MOBILE_USER_AGENT, Referer: fullUrl } });
    const streams: ResolvedStream[] = [];
    const serverLinks = new Set<string>();
    resp.$('ul#episode-servers li a, div.server-item a').each((_, a) => {
      let dataUrl = resp.$(a).attr('data-ep-url') || resp.$(a).attr('data-url') || resp.$(a).attr('href');
      if (!dataUrl) return;
      if (!dataUrl.startsWith('http') && dataUrl.length > 20) {
        const decoded = safeBase64Decode(dataUrl);
        if (decoded.startsWith('http')) dataUrl = decoded;
      }
      if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) serverLinks.add(dataUrl);
    });
    for (const link of serverLinks) {
      try { streams.push(...await extractStreams(link, fullUrl)); }
      catch (error) { this.logger.debug(`Anime4Up extractor failed: ${(error as Error).message}`); }
    }
    return streams.filter((stream) => stream.url?.startsWith('http://') || stream.url?.startsWith('https://'));
  }
}
