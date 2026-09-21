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
  mainUrl = 'https://www.fasel-hd.com';
  supportedTypes: StremioContentType[] = ['movie', 'series', 'anime'];

  constructor() { super(); this.initLogger(); }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  private identityVerified($: any): boolean {
    const title = $('title').text().toLowerCase();
    const generator = $('meta[name="generator"]').attr('content')?.toLowerCase() || '';
    // The current canonical site exposes content as /video/... and playback as
    // /embed/<id>/. Keep legacy selectors for older canonical pages, but do not
    // accept the unrelated watch.php fallback contract until it has its own adapter.
    const hasCanonicalContract = $('a[href*="/video/"], iframe[src*="/embed/"], iframe[data-src*="/embed/"]').length > 0;
    const hasLegacyCanonicalShape = $('div.postDiv, #episodes, .posterImg, iframe[name="player_iframe"], .serversList').length > 0;
    const hasBrand = title.includes('fasel') || title.includes('فاصل') || generator.includes('wordpress');
    return hasBrand && (hasCanonicalContract || hasLegacyCanonicalShape);
  }

  private parseItems($: any, baseUrl: string, forcedType?: StremioContentType): ProviderItem[] {
    const items: ProviderItem[] = [];
    const seen = new Set<string>();
    const push = (href?: string, title?: string, poster?: string) => {
      if (!href || !title) return;
      const url = this.fixUrl(href, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);
      const inferred: StremioContentType = forcedType || (/\/series\//i.test(url) || /مسلسل/.test(title) ? 'series' : 'movie');
      items.push({ id: this.formatId(url.replace(baseUrl, '')), provider: this.name, type: inferred, title: title.trim(), poster: this.fixUrl(poster, baseUrl), url });
    };
    $('div.postDiv').each((_: any, el: any) => {
      const a = $(el).find('a').first();
      push(a.attr('href'), $(el).find('.h1, h1, .post-title').first().text().trim() || a.attr('title'), $(el).find('img').attr('data-src') || $(el).find('img').attr('src'));
    });
    // Current canonical layout no longer consistently uses postDiv. Restrict the
    // generic path to canonical /video/ links so navigation/tag links never become items.
    $('a[href*="/video/"]').each((_: any, el: any) => {
      const a = $(el); const img = a.find('img').first();
      push(a.attr('href'), a.attr('title') || img.attr('alt') || a.text().trim(), img.attr('data-src') || img.attr('src'));
    });
    return items;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const resp = await this.http.get(`${baseUrl}/?s=${encodeURIComponent(query)}`, { headers: { 'User-Agent': MOBILE_USER_AGENT } });
      return { value: this.parseItems(resp.$, baseUrl), identityVerified: this.identityVerified(resp.$) };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'anime' ? 'anime' : type === 'series' ? 'series' : 'movies';
      const resp = await this.http.get(`${baseUrl}/${path}${page > 1 ? `/page/${page}` : ''}`);
      return { value: this.parseItems(resp.$, baseUrl, type), identityVerified: this.identityVerified(resp.$) };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    return this.withHealthyDomain(async (baseUrl) => {
      const fullUrl = this.fixUrl(contentId, baseUrl); const resp = await this.http.get(fullUrl);
      const title = resp.$('h1.title, h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'FaselHD Title';
      const poster = this.fixUrl(resp.$('.posterImg img, article img').first().attr('src') || resp.$('meta[property="og:image"]').attr('content'), baseUrl); const description = resp.$('.singleDesc p, meta[name="description"]').first().text().trim() || resp.$('meta[name="description"]').attr('content') || ''; const episodes: ProviderEpisode[] = [];
      if (type === 'series' || fullUrl.includes('/series/')) resp.$('#episodes div.epAll a, div.episodes-list a, a[href*="/video/"]').each((idx: number, el: any) => { const epHref = resp.$(el).attr('href'); const epTitle = resp.$(el).text().trim() || resp.$(el).attr('title') || `حلقة ${idx + 1}`; if (!epHref || !/حلقة|episode/i.test(epTitle)) return; const m = epTitle.match(/(\d+)/); episodes.push({ id: this.formatId(epHref.replace(baseUrl, '')), title: epTitle, season: 1, episode: m ? parseInt(m[1], 10) : idx + 1, url: this.fixUrl(epHref, baseUrl), poster }); });
      return { value: { id: this.formatId(contentId), provider: this.name, type: episodes.length ? 'series' : type, title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined }, identityVerified: this.identityVerified(resp.$) };
    });
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const fullUrl = this.fixUrl(episodeId || contentId, baseUrl); const resp = await this.http.get(fullUrl); const streams: ResolvedStream[] = [];
      const playerIframe = resp.$('iframe[name="player_iframe"], iframe[data-src*="player"], iframe[src*="player"], iframe[data-src*="/embed/"], iframe[src*="/embed/"]').first(); const playerUrl = playerIframe.attr('data-src') || playerIframe.attr('src');
      if (playerUrl) try { const fullPlayerUrl = this.fixUrl(playerUrl, baseUrl); const playerRes = await this.http.get(fullPlayerUrl, { headers: { Referer: fullUrl } }); const ctx = { window: {}, document: { getElementById: () => ({}) }, navigator: { userAgent: 'Mozilla/5.0' }, jwplayer: () => ({ setup: (cfg: any) => { if (cfg?.file) streams.push({ name: 'FaselHD Main (HLS)', quality: '1080p / 720p', url: cfg.file, isM3u8: cfg.file.includes('.m3u8'), headers: { Referer: fullPlayerUrl } }); if (Array.isArray(cfg?.sources)) for (const s of cfg.sources) if (s.file) streams.push({ name: `FaselHD ${s.label || 'Direct'}`, quality: s.label || '1080p', url: s.file, isM3u8: s.file.includes('.m3u8'), headers: { Referer: fullPlayerUrl } }); }, on: () => {} }) }; vm.createContext(ctx); for (const sc of playerRes.$('script').map((_: any, s: any) => playerRes.$(s).text()).get()) if (sc.includes('jwplayer') || sc.includes('sources') || sc.includes('eval')) try { vm.runInContext(sc, ctx, { timeout: 2000 }); } catch {} } catch (err) { this.logger.debug(`Error resolving FaselHD player token: ${(err as Error).message}`); }
      const serverLinks: string[] = []; resp.$('#show-servers-list button, ul.serversList li button, .buttonsList button').each((_: any, btn: any) => { const dataHref = resp.$(btn).attr('data-href') || resp.$(btn).attr('onclick')?.match(/https?:\/\/[^'\"]+/)?.[0]; if (dataHref) serverLinks.push(this.fixUrl(dataHref, baseUrl)); });
      for (const sUrl of serverLinks) try { streams.push(...await extractStreams(sUrl, fullUrl)); } catch {}
      return { value: streams, identityVerified: this.identityVerified(resp.$) };
    });
  }
}
