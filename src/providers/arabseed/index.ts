import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class ArabseedProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'arabseed'; name = 'Arabseed (عرب سيد)'; lang = 'ar'; mainUrl = 'https://www.arabseed.wine';
  supportedTypes: StremioContentType[] = ['movie', 'series'];
  constructor() { super(); this.initLogger(); }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return ''; if (url.startsWith('//')) return `https:${url}`;
    try { return new URL(url, baseUrl).toString(); } catch { return ''; }
  }
  private originFor(url: string): string { try { return new URL(url).origin; } catch { return this.mainUrl; } }
  private isContentUrl(url: string, origin: string): boolean {
    try {
      const parsed = new URL(url, origin);
      if (parsed.origin !== new URL(origin).origin) return false;
      const p = parsed.pathname.toLowerCase();
      return p !== '/' && !/^\/(category|tag|genre|actor|year|page|wp-|login|register)(\/|$)/.test(p)
        && !/\/(watch|download)\/?$/.test(p);
    } catch { return false; }
  }
  private hasIdentity(resp: Awaited<ReturnType<HttpClient['get']>>): boolean {
    const body = resp.$('body').text();
    return /arabseed|عرب\s*سيد/i.test(body) && (resp.$('a[href*="/category/films"],a[href*="/category/tv"],a[href$="/watch/"]').length > 0);
  }

  private parseItems(resp: Awaited<ReturnType<HttpClient['get']>>, type?: StremioContentType, baseUrl = this.mainUrl): ProviderItem[] {
    const items: ProviderItem[] = []; const seen = new Set<string>(); const origin = this.originFor(baseUrl);
    // Support both the historical cards and the current WordPress-style cards. The latter expose
    // content as same-origin root slugs while categories live below /category/.
    resp.$('a.movie__block, div.MovieBlock a, div.PostBlock a, article a, a[href]').each((_, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a').first();
      const href = a.attr('href'); if (!href) return;
      const absolute = this.fixUrl(href, origin); if (!absolute || !this.isContentUrl(absolute, origin) || seen.has(absolute)) return;
      const container = a.closest('article, li, div');
      const title = (a.attr('title') || a.find('img').attr('alt') || container.find('h1,h2,h3,h4,.Title,.title').first().text() || a.text()).replace(/\s+/g, ' ').trim();
      if (!title || title.length < 4 || /^(عرب سيد|افلام|المسلسلات|مسلسلات|مشاهدة الان|تحميل الان|المزيد)$/i.test(title)) return;
      const context = `${title} ${container.text()}`;
      // Navigation/person links can also be same-origin root slugs. Require a content signal.
      if (!/(مسلسل|الحلقة|الموسم|فيلم|\b20\d{2}\b|WEB-DL|BluRay|HDCAM|القسم|الجودة)/i.test(context)) return;
      seen.add(absolute);
      const img = a.find('img').first().length ? a.find('img').first() : container.find('img').first();
      const poster = this.fixUrl(img.attr('data-src') || img.attr('src'), origin);
      const inferred: StremioContentType = /(مسلسل|الحلقة|الموسم)/.test(context) ? 'series' : 'movie';
      items.push({ id: this.formatId(absolute), provider: this.name, type: type || inferred, title, poster, url: absolute });
    });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      // Current site uses WordPress search. Keep the legacy endpoint as a bounded fallback.
      const candidates = [`${baseUrl}/?s=${encodeURIComponent(query)}`, `${baseUrl}/find/?find=${encodeURIComponent(query)}`];
      for (const url of candidates) {
        const resp = await this.http.get(url); const identity = this.hasIdentity(resp); const items = this.parseItems(resp, undefined, baseUrl);
        if (identity && items.length) return { value: items, identityVerified: true };
      }
      return { value: [], identityVerified: false };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const category = type === 'series' ? 'tv' : 'films';
      const suffix = page > 1 ? `/page/${page}/` : '/';
      const resp = await this.http.get(`${baseUrl}/category/${category}${suffix}`);
      const items = this.parseItems(resp, type, baseUrl);
      return { value: items, identityVerified: this.hasIdentity(resp) && items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId); const origin = this.originFor(fullUrl); const resp = await this.http.get(fullUrl);
    const title = resp.$('h1.Title, h1, h3').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Arabseed Title';
    const poster = this.fixUrl(resp.$('.Poster img, .post__image img, article img').first().attr('data-src') || resp.$('.Poster img, .post__image img, article img').first().attr('src') || resp.$('meta[property="og:image"]').attr('content'), origin);
    const description = resp.$('.Story p, .post__info p, article p').first().text().trim(); const episodes: ProviderEpisode[] = [];
    if (type === 'series' || /مسلسل|الحلقة|الموسم/.test(title)) {
      resp.$('a[href*="episode"], a').each((idx, el) => {
        const epHref = resp.$(el).attr('href'); const epTitle = resp.$(el).text().replace(/\s+/g,' ').trim();
        if (!epHref || !/الحلقة\s*\d+|episode[-_/]?\d+/i.test(`${epTitle} ${epHref}`)) return;
        const absolute = this.fixUrl(epHref, origin); if (!this.isContentUrl(absolute, origin)) return;
        const match = `${epTitle} ${epHref}`.match(/(?:الحلقة|episode[-_/]?)(\d+)/i);
        episodes.push({ id: this.formatId(absolute), title: epTitle || `حلقة ${idx + 1}`, season: 1, episode: match ? parseInt(match[1],10) : idx + 1, url: absolute, poster });
      });
    }
    return { id:this.formatId(fullUrl), provider:this.name, type:episodes.length?'series':type, title, poster, description, url:fullUrl, episodes:episodes.length?episodes:undefined };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const fullUrl=this.fixUrl(episodeId||contentId); const origin=this.originFor(fullUrl); const resp=await this.http.get(fullUrl); const streams:ResolvedStream[]=[]; const serverLinks=new Set<string>();
    const watchHref=resp.$('a[href$="/watch/"], a[href*="/watch/"], a.watchBTn').first().attr('href'); const watchPageUrl=watchHref?this.fixUrl(watchHref,origin):`${fullUrl.replace(/\/$/,'')}/watch/`;
    try { const watch=await this.http.get(watchPageUrl,{headers:{Referer:fullUrl}}); watch.$('[data-src],[data-link],[data-embed],iframe').each((_,el)=>{const link=watch.$(el).attr('data-src')||watch.$(el).attr('data-link')||watch.$(el).attr('data-embed')||watch.$(el).attr('src');if(link)serverLinks.add(this.fixUrl(link,origin));}); } catch(e){this.logger.debug(`Error loading watch page: ${(e as Error).message}`);}
    const downloadHref=resp.$('a[href*="/download/"]').first().attr('href'); if(downloadHref){try{const download=await this.http.get(this.fixUrl(downloadHref,origin),{headers:{Referer:fullUrl}});download.$('a[href]').each((_,a)=>{const href=download.$(a).attr('href');if(href&&/(mixdrop|dood|myvid|\.m3u8|\.mp4)/i.test(href))serverLinks.add(this.fixUrl(href.replace('/d/','/e/').replace('/f/','/e/'),origin));});}catch(e){this.logger.debug(`Error loading download page: ${(e as Error).message}`);}}
    for(const serverUrl of serverLinks){try{streams.push(...await extractStreams(serverUrl,watchPageUrl));}catch(e){this.logger.debug(`ArabSeed extractor failed: ${(e as Error).message}`);}}
    return streams.filter(stream=>/^https?:\/\//i.test(stream.url));
  }
}
