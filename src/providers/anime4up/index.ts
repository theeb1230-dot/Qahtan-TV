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
    if (!url.startsWith('http')) {
      const origin = this.originFor(baseUrl);
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  }

  private originFor(url: string): string {
    try { return new URL(url).origin; } catch { return this.mainUrl; }
  }

  private landingUrl(baseUrl: string): string {
    return `${this.originFor(baseUrl)}/home8/`;
  }

  private parseItems(resp: Awaited<ReturnType<HttpClient['get']>>, type?: StremioContentType, baseUrl = this.mainUrl): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    const push = (title: string, href?: string, poster?: string) => {
      if (!title || !href) return;
      const absolute = this.fixUrl(href, baseUrl);
      if (!absolute.includes('/anime/') || seen.has(absolute)) return;
      seen.add(absolute);
      const inferred: StremioContentType = title.includes('فيلم') || href.includes('/movie/') ? 'movie' : 'anime';
      items.push({ id: this.formatId(absolute), provider: this.name, type: type || inferred, title, poster: this.fixUrl(poster, baseUrl), url: absolute });
    };

    resp.$('div.anime-card-container').each((_, el) => {
      const a = resp.$(el).find('.anime-title a');
      push(a.text().trim(), a.attr('href'), resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
    });

    resp.$('a[href*="/anime/"]').each((_, el) => {
      const a = resp.$(el);
      const container = a.closest('article, div, li');
      const title = (a.attr('title') || a.find('h2,h3,h4').first().text() || a.text()).trim();
      const img = container.find('img').first();
      push(title, a.attr('href'), img.attr('data-src') || img.attr('src'));
    });
    return items;
  }

  private hasIdentity(resp: Awaited<ReturnType<HttpClient['get']>>, items: ProviderItem[]): boolean {
    const title = (resp.$('title').text() || resp.$('h1').first().text()).toLowerCase();
    const documentText = resp.$('body').text().replace(/\s+/g, ' ').toLowerCase();
    const brandFingerprint = title.includes('anime4up') || title.includes('انمي فور اب') || title.includes('أنمي فور اب') ||
      documentText.includes('anime4up') || documentText.includes('انمي فور اب') || documentText.includes('أنمي فور اب');
    return brandFingerprint && items.length > 0;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const origin = this.originFor(baseUrl);
      const search = await this.http.get(`${origin}/?search_string=${encodeURIComponent(query)}`, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      let items = this.parseItems(search, undefined, origin);
      let identityVerified = this.hasIdentity(search, items);
      if (items.length === 0 || !identityVerified) {
        // The canonical origin redirects to /home8/ in browsers, but hosted HTTP
        // clients do not always receive the same redirect representation. Probe
        // the documented first-party landing explicitly before declaring identity
        // failure; this is ordinary same-origin navigation, not challenge bypass.
        const home = await this.http.get(this.landingUrl(baseUrl), { headers: { 'User-Agent': MOBILE_USER_AGENT } });
        const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const homeItems = this.parseItems(home, undefined, origin);
        items = homeItems.filter((item) => tokens.every((token) => item.title.toLocaleLowerCase().includes(token)));
        identityVerified = this.hasIdentity(home, homeItems);
      }
      return { value: items, identityVerified };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const origin = this.originFor(baseUrl);
      const path = type === 'movie' ? 'anime-type/movie' : 'anime-season';
      const resp = await this.http.get(`${origin}/${path}/page/${page}/`, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      let items = this.parseItems(resp, type, origin);
      let identityVerified = this.hasIdentity(resp, items);
      if ((items.length === 0 || !identityVerified) && page === 1) {
        const home = await this.http.get(this.landingUrl(baseUrl), { headers: { 'User-Agent': MOBILE_USER_AGENT } });
        items = this.parseItems(home, type, origin);
        identityVerified = this.hasIdentity(home, items);
      }
      return { value: items, identityVerified };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const origin = this.originFor(fullUrl);
    const resp = await this.http.get(fullUrl, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
    const title = resp.$('h1.anime-details-title').text().trim() || resp.$('h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Anime Title';
    const poster = this.fixUrl(resp.$('.anime-thumbnail img').attr('src') || resp.$('meta[property="og:image"]').attr('content'), origin);
    const description = resp.$('p.anime-story').text().trim() || resp.$('meta[name="description"]').attr('content') || '';
    const episodes: ProviderEpisode[] = [];
    const seenEpisodes = new Set<string>();
    resp.$('div.episodes-card-container a, div.DivEpisodesContainer a, a[href*="/episode/"]').each((idx, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a');
      const epHref = a.attr('href');
      if (!epHref) return;
      const absolute = this.fixUrl(epHref, origin);
      if (!absolute.includes('/episode/') || seenEpisodes.has(absolute)) return;
      seenEpisodes.add(absolute);
      const contextText = `${a.attr('title') || ''} ${a.text()} ${a.closest('article,div,li').text()}`.replace(/\s+/g, ' ').trim();
      const epNumMatch = contextText.match(/(?:الحلقة|episode)\s*(?:الخاصة\s*)?(\d+)/i) || absolute.match(/(?:episode|الحلقة)[^0-9]*(\d+)/i);
      const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1;
      episodes.push({ id: this.formatId(absolute), title: contextText || `الحلقة ${epNum}`, season: 1, episode: epNum, url: absolute, poster });
    });
    return { id: this.formatId(fullUrl), provider: this.name, type: type === 'movie' ? 'movie' : 'anime', title, poster, description, url: fullUrl, episodes: episodes.length > 0 ? episodes : undefined };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetPath = episodeId || contentId;
    const fullUrl = this.fixUrl(targetPath);
    const origin = this.originFor(fullUrl);
    const resp = await this.http.get(fullUrl, { headers: { 'User-Agent': MOBILE_USER_AGENT, Referer: fullUrl } });
    const streams: ResolvedStream[] = [];
    const serverLinks = new Set<string>();
    const addServerLink = (raw?: string) => {
      if (!raw) return;
      let candidate = raw.trim();
      if (!candidate) return;
      if (!candidate.startsWith('http') && !candidate.startsWith('//') && !candidate.startsWith('/')) {
        const decoded = safeBase64Decode(candidate);
        if (decoded && decoded !== candidate) candidate = decoded.trim();
      }
      const absolute = this.fixUrl(candidate, origin);
      if (/^https?:\/\//i.test(absolute)) serverLinks.add(absolute);
    };
    resp.$('ul#episode-servers li a, div.server-item a, [data-ep-url], [data-url]').each((_, el) => {
      addServerLink(resp.$(el).attr('data-ep-url') || resp.$(el).attr('data-url') || resp.$(el).attr('href'));
    });
    resp.$('iframe[src]').each((_, el) => addServerLink(resp.$(el).attr('src')));
    for (const link of serverLinks) {
      try { streams.push(...await extractStreams(link, fullUrl)); }
      catch (error) { this.logger.debug(`Anime4Up extractor failed: ${(error as Error).message}`); }
    }
    return streams.filter((stream) => stream.url?.startsWith('http://') || stream.url?.startsWith('https://'));
  }
}
