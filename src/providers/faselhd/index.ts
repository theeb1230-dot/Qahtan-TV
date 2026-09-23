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

  private effectiveOrigin(url: string | undefined, fallback: string): string {
    try {
      const parsed = new URL(url || fallback);
      return parsed.origin;
    } catch {
      return fallback.replace(/\/$/, '');
    }
  }

  private brandVerified($: any): boolean {
    const title = $('title').text().toLowerCase();
    const ogSite = $('meta[property="og:site_name"]').attr('content')?.toLowerCase() || '';
    return title.includes('fasel') || title.includes('فاصل') || ogSite.includes('fasel') || ogSite.includes('فاصل');
  }

  private parserContractVerified($: any): boolean {
    const canonical = $('a[href*="/video/"], a[href*="/watch/"], a[href*="/series/"], a[href*="/movie/"], a[href*="/post/"], a[href*="watch.php?"], iframe[src*="/embed/"], iframe[data-src*="/embed/"]').length > 0;
    const player = $('iframe[name="player_iframe"], iframe[src*="player"], iframe[data-src*="player"], .serversList, .buttonsList, .postDiv, article, .post, .item').length > 0;
    return canonical || player;
  }

  private identityVerified($: any): boolean {
    return this.brandVerified($) && this.parserContractVerified($);
  }

  private sitemapLocations(xml: string): string[] {
    return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?\s*<\/loc>/gi)]
      .map((match) => match[1].trim().replace(/&amp;/g, '&'));
  }

  private landingCandidates($: any, effectiveOrigin: string): string[] {
    const candidates: string[] = [];
    $('a[href], link[href]').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, effectiveOrigin);
        if (url.hostname !== new URL(effectiveOrigin).hostname) return;
        if (/\/(video|watch|series|movie|post)\//i.test(url.pathname) || /\/watch\.php$/i.test(url.pathname) || /[?&](vid|id)=/i.test(url.search)) candidates.push(url.href);
      } catch {}
    });
    return [...new Set(candidates)];
  }

  private async verifyCanonicalDomain(baseUrl: string): Promise<boolean> {
    const allowedHosts = new Set([
      'www.fasel-hd.co', 'fasel-hd.co', 'www.fasel-hd.com', 'fasel-hd.com',
      'fasellhd.rest', 'fasellhd.baby',
    ]);
    const parsedBase = new URL(baseUrl);
    if (!allowedHosts.has(parsedBase.hostname)) {
      this.logger.debug(`FaselHD identity rejected non-canonical host ${parsedBase.hostname}`);
      return false;
    }
    const headers = { 'User-Agent': MOBILE_USER_AGENT };
    try {
      const landing = await this.http.get(`${baseUrl}/`, { headers, timeout: 7000 });
      const landingBrand = this.brandVerified(landing.$);
      const landingContract = this.parserContractVerified(landing.$);
      const effectiveOrigin = this.effectiveOrigin(landing.url, baseUrl);
      const effectiveHost = new URL(effectiveOrigin).hostname;
      this.logger.debug(`FaselHD identity landing status=${landing.status} finalHost=${effectiveHost} brand=${landingBrand} parserContract=${landingContract} bytes=${landing.text.length}`);
      if (landing.status >= 200 && landing.status < 400 && landingBrand && landingContract) return true;
      if (landing.status < 200 || landing.status >= 400) return false;

      const landingContentCandidate = this.landingCandidates(landing.$, effectiveOrigin).find(Boolean) || '';
      if (landingContentCandidate) {
        const sample = await this.http.get(landingContentCandidate, { headers, timeout: 7000 });
        const sampleBrand = this.brandVerified(sample.$);
        const sampleContract = this.parserContractVerified(sample.$);
        this.logger.debug(`FaselHD identity landing candidate status=${sample.status} host=${new URL(landingContentCandidate).hostname} path=${new URL(landingContentCandidate).pathname} brand=${sampleBrand} parserContract=${sampleContract} bytes=${sample.text.length}`);
        if (sample.status >= 200 && sample.status < 400 && sampleBrand && sampleContract) return true;
      }

      const sitemapSeeds = ['/wp-sitemap.xml', '/sitemap_index.xml', '/wp-sitemap-posts-post-1.xml', '/post-sitemap.xml'];
      const checked = new Set<string>();
      const sitemapQueue = sitemapSeeds.map((path) => `${effectiveOrigin}${path}`);
      let contentCandidate = '';

      while (sitemapQueue.length && checked.size < 8 && !contentCandidate) {
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
              return parsed.hostname === effectiveHost && (/\/(video|watch|series|movie|post)\//i.test(parsed.pathname) || /\/watch\.php$/i.test(parsed.pathname) || /[?&](vid|id)=/i.test(parsed.search));
            } catch { return false; }
          }) || '';
          if (!contentCandidate) {
            for (const location of locations) {
              try {
                const parsed = new URL(location);
                if (parsed.hostname === effectiveHost && /sitemap.*\.xml|wp-sitemap.*\.xml/i.test(parsed.pathname) && !checked.has(location)) sitemapQueue.push(location);
              } catch {}
              if (sitemapQueue.length >= 10) break;
            }
          }
        } catch (err) {
          this.logger.debug(`FaselHD sitemap probe failed path=${new URL(sitemapUrl).pathname}: ${(err as Error).message}`);
        }
      }

      if (!contentCandidate) {
        this.logger.debug(`FaselHD identity found no same-host content candidate after ${checked.size} sitemap probes`);
        return false;
      }
      const sample = await this.http.get(contentCandidate, { headers, timeout: 7000 });
      const sampleBrand = this.brandVerified(sample.$);
      const sampleContract = this.parserContractVerified(sample.$);
      this.logger.debug(`FaselHD identity sample status=${sample.status} host=${new URL(contentCandidate).hostname} path=${new URL(contentCandidate).pathname} brand=${sampleBrand} parserContract=${sampleContract} bytes=${sample.text.length}`);
      return sample.status >= 200 && sample.status < 400 && sampleBrand && sampleContract;
    } catch (err) {
      this.logger.debug(`FaselHD identity probe failed for ${baseUrl}: ${(err as Error).message}`);
      return false;
    }
  }

  private parseItems($: any, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const items: ProviderItem[] = []; const seen = new Set<string>();
    const push = (href?: string, title?: string, poster?: string) => { if (!href || !title) return; const url = this.fixUrl(href, baseUrl); if (seen.has(url)) return; seen.add(url); const inferred: StremioContentType = forcedType || (/\/(series|tv)\//i.test(url) || /مسلسل|حلقة|episode/i.test(title) ? 'series' : 'movie'); items.push({ id: this.formatId(url.replace(baseUrl, '')), provider: this.name, type: inferred, title: title.trim(), poster: this.fixUrl(poster, baseUrl), url }); };
    $('div.postDiv, article, .post, .item, .post-item').each((_: any, el: any) => { const a = $(el).find('a').first(); const img = $(el).find('img').first(); push(a.attr('href'), $(el).find('.h1, h1, .post-title, .title').first().text().trim() || a.attr('title') || img.attr('alt') || a.text().trim(), img.attr('data-src') || img.attr('src')); });
    $('a[href*="/video/"], a[href*="/watch/"], a[href*="/series/"], a[href*="/movie/"], a[href*="/post/"], a[href*="watch.php?"]').each((_: any, el: any) => { const a = $(el); const img = a.find('img').first(); push(a.attr('href'), a.attr('title') || img.attr('alt') || a.text().trim(), img.attr('data-src') || img.attr('src')); });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> { return this.withHealthyDomain(async (baseUrl) => { const identityVerified = await this.verifyCanonicalDomain(baseUrl); if (!identityVerified) return { value: [], identityVerified: false }; const resp = await this.http.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers: { 'User-Agent': MOBILE_USER_AGENT } }); const effectiveBase = this.effectiveOrigin(resp.url, baseUrl); return { value: this.parseItems(resp.$, effectiveBase), identityVerified: true }; }); }
  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> { return this.withHealthyDomain(async (baseUrl) => { const identityVerified = await this.verifyCanonicalDomain(baseUrl); if (!identityVerified) return { value: [], identityVerified: false }; const path = type === 'anime' ? 'anime' : type === 'series' ? 'series' : 'movies'; const resp = await this.http.get(`${baseUrl}/${path}${page > 1 ? `/page/${page}` : ''}`); const effectiveBase = this.effectiveOrigin(resp.url, baseUrl); return { value: this.parseItems(resp.$, effectiveBase, type), identityVerified: true }; }); }
  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> { return this.withHealthyDomain(async (baseUrl) => { const fullUrl = this.fixUrl(contentId, baseUrl); const resp = await this.http.get(fullUrl); const effectiveBase = this.effectiveOrigin(resp.url, baseUrl); const title = resp.$('h1.title, h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'FaselHD Title'; const poster = this.fixUrl(resp.$('.posterImg img, article img').first().attr('src') || resp.$('meta[property="og:image"]').attr('content'), effectiveBase); const description = resp.$('.singleDesc p, meta[name="description"]').first().text().trim() || resp.$('meta[name="description"]').attr('content') || ''; const episodes: ProviderEpisode[] = []; if (type === 'series' || fullUrl.includes('/series/')) resp.$('#episodes div.epAll a, div.episodes-list a, a[href*="/video/"], a[href*="/episode/"], a[href*="watch.php?"]').each((idx: number, el: any) => { const epHref = resp.$(el).attr('href'); const epTitle = resp.$(el).text().trim() || resp.$(el).attr('title') || `حلقة ${idx + 1}`; if (!epHref || !/حلقة|episode|ep\.?\s*\d+|watch\.php/i.test(epTitle + epHref)) return; const m = epTitle.match(/(\d+)/); episodes.push({ id: this.formatId(this.fixUrl(epHref, effectiveBase).replace(effectiveBase, '')), title: epTitle, season: 1, episode: m ? parseInt(m[1], 10) : idx + 1, url: this.fixUrl(epHref, effectiveBase), poster }); }); return { value: { id: this.formatId(this.fixUrl(contentId, effectiveBase).replace(effectiveBase, '')), provider: this.name, type: episodes.length ? 'series' : type, title, poster, description, url: this.fixUrl(contentId, effectiveBase), episodes: episodes.length ? episodes : undefined }, identityVerified: this.identityVerified(resp.$) }; }); }
  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> { return this.withHealthyDomain(async (baseUrl) => { const fullUrl = this.fixUrl(episodeId || contentId, baseUrl); const resp = await this.http.get(fullUrl); const effectiveBase = this.effectiveOrigin(resp.url, baseUrl); const streams: ResolvedStream[] = []; const playerIframe = resp.$('iframe[name="player_iframe"], iframe[data-src*="player"], iframe[src*="player"], iframe[data-src*="/embed/"], iframe[src*="/embed/"]').first(); const playerUrl = playerIframe.attr('data-src') || playerIframe.attr('src'); if (playerUrl) try { const fullPlayerUrl = this.fixUrl(playerUrl, effectiveBase); const playerRes = await this.http.get(fullPlayerUrl, { headers: { Referer: resp.url || fullUrl } }); const ctx = { window: {}, document: { getElementById: () => ({}) }, navigator: { userAgent: 'Mozilla/5.0' }, jwplayer: () => ({ setup: (cfg: any) => { if (cfg?.file) streams.push({ name: 'FaselHD Main (HLS)', quality: '1080p / 720p', url: cfg.file, isM3u8: cfg.file.includes('.m3u8'), headers: { Referer: fullPlayerUrl } }); if (Array.isArray(cfg?.sources)) for (const s of cfg.sources) if (s.file) streams.push({ name: `FaselHD ${s.label || 'Direct'}`, quality: s.label || '1080p', url: s.file, isM3u8: s.file.includes('.m3u8'), headers: { Referer: fullPlayerUrl } }); }, on: () => {} }) }; vm.createContext(ctx); for (const sc of playerRes.$('script').map((_: any, s: any) => playerRes.$(s).text()).get()) if (sc.includes('jwplayer') || sc.includes('sources') || sc.includes('eval')) try { vm.runInContext(sc, ctx, { timeout: 2000 }); } catch {} } catch (err) { this.logger.debug(`Error resolving FaselHD player token: ${(err as Error).message}`); } const serverLinks: string[] = []; resp.$('#show-servers-list button, ul.serversList li button, .buttonsList button').each((_: any, btn: any) => { const dataHref = resp.$(btn).attr('data-href') || resp.$(btn).attr('onclick')?.match(/https?:\/\/[^'\"]+/)?.[0]; if (dataHref) serverLinks.push(this.fixUrl(dataHref, effectiveBase)); }); for (const sUrl of serverLinks) try { streams.push(...await extractStreams(sUrl, resp.url || fullUrl)); } catch {} return { value: streams, identityVerified: this.identityVerified(resp.$) }; }); }
}
