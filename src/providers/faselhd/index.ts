import vm from 'node:vm';
import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class FaselhdProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'faselhd';
  name = 'FaselHD (فاصل إعلاني)';
  lang = 'ar';
  mainUrl = 'https://www.fasel-hd.co';
  supportedTypes: StremioContentType[] = ['movie', 'series', 'anime'];

  constructor() { super(); this.initLogger(); }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  private brandVerified($: any): boolean {
    const title = $('title').text().toLowerCase();
    const ogSite = $('meta[property="og:site_name"]').attr('content')?.toLowerCase() || '';
    return title.includes('fasel') || title.includes('فاصل') || ogSite.includes('fasel') || ogSite.includes('فاصل');
  }

  private parserContractVerified($: any): boolean {
    const hasCanonicalContract = $('a[href*="/video/"], iframe[src*="/embed/"], iframe[data-src*="/embed/"]').length > 0;
    const hasLegacyCanonicalShape = $('div.postDiv, #episodes, .posterImg, iframe[name="player_iframe"], .serversList').length > 0;
    return hasCanonicalContract || hasLegacyCanonicalShape;
  }

  private identityVerified($: any): boolean {
    return this.brandVerified($) && this.parserContractVerified($);
  }

  private sitemapLocations(xml: string): string[] {
    return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?\s*<\/loc>/gi)]
      .map((match) => match[1].trim().replace(/&amp;/g, '&'));
  }

  private async verifyCanonicalDomain(baseUrl: string): Promise<boolean> {
    const allowedHosts = new Set(['www.fasel-hd.co', 'fasel-hd.co', 'www.fasel-hd.com', 'fasel-hd.com']);
    if (!allowedHosts.has(new URL(baseUrl).hostname)) {
      this.logger.debug(`FaselHD identity rejected non-canonical host ${new URL(baseUrl).hostname}`);
      return false;
    }
    const headers = { 'User-Agent': MOBILE_USER_AGENT };
    try {
      const landing = await this.http.get(`${baseUrl}/`, { headers, timeout: 7000 });
      const landingBrand = this.brandVerified(landing.$);
      const landingContract = this.parserContractVerified(landing.$);
      this.logger.debug(`FaselHD identity landing status=${landing.status} finalHost=${new URL(landing.url).hostname} brand=${landingBrand} parserContract=${landingContract} bytes=${landing.text.length}`);
      if (landing.status >= 200 && landing.status < 400 && landingBrand && landingContract) return true;
      if (landing.status < 200 || landing.status >= 400) return false;

      const sitemapSeeds = ['/wp-sitemap.xml', '/sitemap_index.xml', '/wp-sitemap-posts-post-1.xml', '/post-sitemap.xml'];
      const checked = new Set<string>();
      const sitemapQueue = sitemapSeeds.map((path) => `${baseUrl}${path}`);
      let contentCandidate = '';

      while (sitemapQueue.length && checked.size < 6 && !contentCandidate) {
        const sitemapUrl = sitemapQueue.shift()!;
        if (checked.has(sitemapUrl)) continue;
        checked.add(sitemapUrl);
        try {
          const sitemap = await this.http.get(sitemapUrl, { headers, timeout: 5000 });
          const locations = this.sitemapLocations(sitemap.text);
          this.logger.debug(`FaselHD sitemap status=${sitemap.status} path=${new URL(sitemapUrl).pathname} locations=${locations.length}`);
          if (sitemap.status < 200 || sitemap.status >= 400) continue;
          contentCandidate = locations.find((url) => {
            try {
              const parsed = new URL(url);
              return parsed.hostname === new URL(baseUrl).hostname && /\/video\//i.test(parsed.pathname);
            } catch { return false; }
          }) || '';
          if (!contentCandidate) {
            for (const location of locations) {
              try {
                const parsed = new URL(location);
                if (parsed.hostname === new URL(baseUrl).hostname && /sitemap.*\.xml|wp-sitemap.*\.xml/i.test(parsed.pathname) && !checked.has(location)) sitemapQueue.push(location);
              } catch {}
              if (sitemapQueue.length >= 8) break;
            }
          }
        } catch (err) {
          this.logger.debug(`FaselHD sitemap probe failed path=${new URL(sitemapUrl).pathname}: ${(err as Error).message}`);
        }
      }

      if (!contentCandidate) {
        this.logger.debug(`FaselHD identity found no same-host /video/ candidate after ${checked.size} sitemap probes`);
        return false;
      }
      const sample = await this.http.get(contentCandidate, { headers, timeout: 7000 });
      const sampleBrand = this.brandVerified(sample.$);
      const sampleContract = this.parserContractVerified(sample.$);
      this.logger.debug(`FaselHD identity sample status=${sample.status} path=${new URL(contentCandidate).pathname} brand=${sampleBrand} parserContract=${sampleContract} bytes=${sample.text.length}`);
      return sample.status >= 200 && sample.status < 400 && sampleBrand && sampleContract;
    } catch (err) {
      this.logger.debug(`FaselHD identity probe failed for ${baseUrl}: ${(err as Error).message}`);
      return false;
    }
  }

  private parseItems($: any, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const items: ProviderItem[] = []; const seen = new Set<string>();
    const push = (href?: string, title?: string, poster?: string) => { if (!href || !title) return; const url = this.fixUrl(href, baseUrl); if (seen.has(url)) return; seen.add(url); const inferred: StremioContentType = forcedType || (/\/series\//i.test(url) || /مسلسل/.test(title) ? 'series' : 'movie'); items.push({ id: this.formatId(url.replace(baseUrl, '')), provider: this.name, type: inferred, title: title.trim(), poster: this.fixUrl(poster, baseUrl), url }); };
    $('div.postDiv').each((_: any, el: any) => { const a = $(el).find('a').first(); push(a.attr('href'), $(el).find('.h1, h1, .post-title').first().text().trim() || a.attr('title'), $(el).find('img').attr('data-src') || $(el).find('img').attr('src')); });
    $('a[href*="/video/"]').each((_: any, el: any) => { const a = $(el); const img = a.find('img').first(); push(a.attr('href'), a.attr('title') || img.attr('alt') || a.text().trim(), img.attr('data-src') || img.attr('src')); });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> { return this.withHealthyDomain(async (baseUrl) => { const identityVerified = await this.verifyCanonicalDomain(baseUrl); if (!identityVerified) return { value: [], identityVerified: false }; const resp = await this.http.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers: { 'User-Agent': MOBILE_USER_AGENT } }); return { value: this.parseItems(resp.$, baseUrl), identityVerified: true }; }); }
  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> { return this.withHealthyDomain(async (baseUrl) => { const identityVerified = await this.verifyCanonicalDomain(baseUrl); if (!identityVerified) return { value: [], identityVerified: false }; const path = type === 'anime' ? 'anime' : type === 'series' ? 'series' : 'movies'; const resp = await this.http.get(`${baseUrl}/${path}${page > 1 ? `/page/${page}` : ''}`); return { value: this.parseItems(resp.$, baseUrl, type), identityVerified: true }; }); }
  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> { return this.withHealthyDomain(async (baseUrl) => { const fullUrl = this.fixUrl(contentId, baseUrl); const resp = await this.http.get(fullUrl); const title = resp.$('h1.title, h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'FaselHD Title'; const poster = this.fixUrl(resp.$('.posterImg img, article img').first().attr('src') || resp.$('meta[property="og:image"]').attr('content'), baseUrl); const description = resp.$('.singleDesc p, meta[name="description"]').first().text().trim() || resp.$('meta[name="description"]').attr('content') || ''; const episodes: ProviderEpisode[] = []; if (type === 'series' || fullUrl.includes('/series/')) resp.$('#episodes div.epAll a, div.episodes-list a, a[href*="/video/"]').each((idx: number, el: any) => { const epHref = resp.$(el).attr('href'); const epTitle = resp.$(el).text().trim() || resp.$(el).attr('title') || `حلقة ${idx + 1}`; if (!epHref || !/حلقة|episode/i.test(epTitle)) return; const m = epTitle.match(/(\d+)/); episodes.push({ id: this.formatId(epHref.replace(baseUrl, '')), title: epTitle, season: 1, episode: m ? parseInt(m[1], 10) : idx + 1, url: this.fixUrl(epHref, baseUrl), poster }); }); return { value: { id: this.formatId(contentId), provider: this.name, type: episodes.length ? 'series' : type, title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined }, identityVerified: this.identityVerified(resp.$) }; }); }
  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> { return this.withHealthyDomain(async (baseUrl) => { const fullUrl = this.fixUrl(episodeId || contentId, baseUrl); const resp = await this.http.get(fullUrl); const streams: ResolvedStream[] = []; const playerIframe = resp.$('iframe[name="player_iframe"], iframe[data-src*="player"], iframe[src*="player"], iframe[data-src*="/embed/"], iframe[src*="/embed/"]').first(); const playerUrl = playerIframe.attr('data-src') || playerIframe.attr('src'); if (playerUrl) try { const fullPlayerUrl = this.fixUrl(playerUrl, baseUrl); const playerRes = await this.http.get(fullPlayerUrl, { headers: { Referer: fullUrl } }); const ctx = { window: {}, document: { getElementById: () => ({}) }, navigator: { userAgent: 'Mozilla/5.0' }, jwplayer: () => ({ setup: (cfg: any) => { if (cfg?.file) streams.push({ name: 'FaselHD Main (HLS)', quality: '1080p / 720p', url: cfg.file, isM3u8: cfg.file.includes('.m3u8'), headers: { Referer: fullPlayerUrl } }); if (Array.isArray(cfg?.sources)) for (const s of cfg.sources) if (s.file) streams.push({ name: `FaselHD ${s.label || 'Direct'}`, quality: s.label || '1080p', url: s.file, isM3u8: s.file.includes('.m3u8'), headers: { Referer: fullPlayerUrl } }); }, on: () => {} }) }; vm.createContext(ctx); for (const sc of playerRes.$('script').map((_: any, s: any) => playerRes.$(s).text()).get()) if (sc.includes('jwplayer') || sc.includes('sources') || sc.includes('eval')) try { vm.runInContext(sc, ctx, { timeout: 2000 }); } catch {} } catch (err) { this.logger.debug(`Error resolving FaselHD player token: ${(err as Error).message}`); } const serverLinks: string[] = []; resp.$('#show-servers-list button, ul.serversList li button, .buttonsList button').each((_: any, btn: any) => { const dataHref = resp.$(btn).attr('data-href') || resp.$(btn).attr('onclick')?.match(/https?:\/\/[^'\"]+/)?.[0]; if (dataHref) serverLinks.push(this.fixUrl(dataHref, baseUrl)); }); for (const sUrl of serverLinks) try { streams.push(...await extractStreams(sUrl, fullUrl)); } catch {} return { value: streams, identityVerified: this.identityVerified(resp.$) }; }); }
}
