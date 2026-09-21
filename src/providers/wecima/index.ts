import { BaseProvider } from '../base.js';
import type { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import type { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';

export class WecimaProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'wecima';
  name = 'WeCima';
  lang = 'ar';
  mainUrl = 'https://wecima.cx';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() { super(); this.initLogger(); }

  private fixUrl(url: string | undefined, base: string): string {
    if (!url) return '';
    try { return new URL(url, base).toString(); } catch { return url; }
  }

  private contentOrigin(id: string): string {
    const normalized = id.startsWith(`${this.id}:`) ? id.slice(this.id.length + 1) : id;
    try { return new URL(normalized).origin; } catch { return this.mainUrl; }
  }

  private hasCanonicalContent(resp: Awaited<ReturnType<typeof this.http.get>>): boolean {
    return resp.$('a[href*="/series/"],a[href*="/movies/"],a[href*="/watch/"]').length > 0;
  }

  private isIdentityVerified(resp: Awaited<ReturnType<typeof this.http.get>>): boolean {
    const title = resp.$('title').text();
    const body = resp.$('body').text().slice(0, 12000);
    const branded = /we\s*cima|wecima|وى\s*سيما|وي\s*سيما|ما[ىي]\s*سيما|my\s*cima|mycima/i.test(`${title} ${body}`);
    return branded && this.hasCanonicalContent(resp);
  }

  private parseItems(resp: Awaited<ReturnType<typeof this.http.get>>, baseUrl: string): ProviderItem[] {
    const out = new Map<string, ProviderItem>();
    resp.$('a[href]').each((_, el) => {
      const href = resp.$(el).attr('href');
      if (!href) return;
      const url = this.fixUrl(href, baseUrl);
      const text = (resp.$(el).attr('title') || resp.$(el).find('h2,h3,.title,.post-title').first().text() || resp.$(el).text()).trim();
      let type: StremioContentType | null = null;
      if (/\/series\//i.test(url) || /episodes\.php/i.test(url) || (/\/watch\//i.test(url) && /مسلسل|حلقة|episode|series/i.test(text))) type = 'series';
      else if (/\/movies\//i.test(url) || /\/movie\//i.test(url) || /\/watch\//i.test(url) || /movies\.php/i.test(url)) type = 'movie';
      if (!type || !text) return;
      const img = resp.$(el).find('img').first();
      const poster = this.fixUrl(img.attr('data-src') || img.attr('src'), baseUrl);
      out.set(url, { id: this.formatId(url), provider: this.name, type, title: text, poster, url });
    });
    return [...out.values()];
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      // Verify the provider against its stable landing-page contract first. Search
      // endpoints legitimately return empty/minimal documents for broad queries;
      // that must not poison an otherwise verified domain in the health manager.
      let domainVerified = false;
      try {
        const home = await this.http.get(`${baseUrl}/`);
        domainVerified = this.isIdentityVerified(home);
      } catch { /* search attempts below still fail closed */ }

      for (const url of [`${baseUrl}/?s=${encodeURIComponent(query)}`, `${baseUrl}/search.php?keyword=${encodeURIComponent(query)}`]) {
        try {
          const resp = await this.http.get(url);
          const items = this.parseItems(resp, baseUrl);
          const responseVerified = this.isIdentityVerified(resp) || (this.hasCanonicalContent(resp) && items.length > 0);
          if (!domainVerified && !responseVerified) continue;
          return { value: items, identityVerified: true };
        } catch { /* try compatible fallback */ }
      }
      // An empty search is a valid search result once the domain itself is verified.
      // Catalog discovery can then proceed without an artificial circuit-breaker trip.
      return { value: [], identityVerified: domainVerified };
    });
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const category = type === 'series' ? 'seriestv' : 'movies';
      const categoryUrl = page > 1 ? `${baseUrl}/${category}/page/${page}/` : `${baseUrl}/${category}`;
      const homeUrl = page > 1 ? `${baseUrl}/page/${page}/` : `${baseUrl}/`;
      const legacy = type === 'series' ? `${baseUrl}/episodes.php${page > 1 ? `?page=${page}` : ''}` : `${baseUrl}/movies.php${page > 1 ? `?page=${page}` : ''}`;
      for (const url of [categoryUrl, homeUrl, legacy]) {
        try {
          const resp = await this.http.get(url);
          const items = this.parseItems(resp, baseUrl).filter((item) => item.type === type);
          const verified = this.isIdentityVerified(resp) || (this.hasCanonicalContent(resp) && items.length > 0);
          if (!verified) continue;
          if (items.length) return { value: items, identityVerified: true };
        } catch { /* try compatible fallback */ }
      }
      return { value: [], identityVerified: false };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const origin = this.contentOrigin(contentId);
    const fullUrl = this.fixUrl(contentId.startsWith(`${this.id}:`) ? contentId.slice(this.id.length + 1) : contentId, origin);
    const resp = await this.http.get(fullUrl);
    const title = resp.$('h1').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || resp.$('title').text().trim();
    if (!title) return null;
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.video-bibplayer-poster').css('background-image')?.replace(/url\(['"]?(.*?)['"]?\)/, '$1'), origin);
    const description = resp.$('meta[property="og:description"]').attr('content') || resp.$('.video-description').text().trim();
    let episodes: ProviderEpisode[] | undefined;
    if (type === 'series') {
      const seen = new Set<string>(); episodes = [];
      resp.$('a[href]').each((_, el) => {
        const href = resp.$(el).attr('href'); const label = (resp.$(el).attr('title') || resp.$(el).text()).trim();
        if (!href || !/حلقة|episode/i.test(label)) return;
        const url = this.fixUrl(href, origin);
        if (!/\/watch\//i.test(url) || seen.has(url)) return;
        seen.add(url);
        const number = Number(label.match(/(?:حلقة|episode)\s*(\d+)/i)?.[1] || episodes!.length + 1);
        episodes!.push({ id: this.formatId(url), title: label, season: 1, episode: number, url });
      });
    }
    return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl, episodes };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetId = episodeId || contentId;
    const normalized = targetId.startsWith(`${this.id}:`) ? targetId.slice(this.id.length + 1) : targetId;
    const origin = this.contentOrigin(normalized); const fullUrl = this.fixUrl(normalized, origin);
    const streams = new Map<string, ResolvedStream>();
    const add = (candidate: string | undefined, referer: string) => {
      const url = this.fixUrl(candidate, referer);
      if (!/^https?:\/\//i.test(url) || streams.has(url)) return;
      streams.set(url, { url, name: this.name, headers: { Referer: referer } });
    };
    try {
      const playRes = await this.http.get(fullUrl, { headers: { Referer: origin } });
      playRes.$('source[src],video[src]').each((_, el) => add(playRes.$(el).attr('src'), fullUrl));
      playRes.$('[data-src],[data-url],[data-file]').each((_, el) => add(playRes.$(el).attr('data-src') || playRes.$(el).attr('data-url') || playRes.$(el).attr('data-file'), fullUrl));
      const iframes: string[] = [];
      playRes.$('iframe[src]').each((_, el) => { const src = this.fixUrl(playRes.$(el).attr('src'), fullUrl); if (/^https?:\/\//i.test(src)) iframes.push(src); });
      for (const iframe of iframes.slice(0, 8)) {
        try {
          const nested = await this.http.get(iframe, { headers: { Referer: fullUrl } });
          nested.$('source[src],video[src],[data-src],[data-url],[data-file]').each((_, el) => add(nested.$(el).attr('src') || nested.$(el).attr('data-src') || nested.$(el).attr('data-url') || nested.$(el).attr('data-file'), iframe));
        } catch { /* browser-only server: do not mislabel iframe as media */ }
      }
    } catch { return []; }
    return [...streams.values()];
  }
}
