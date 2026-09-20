import { BaseProvider } from '../base.js';
import type { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream, StremioContentType } from '../../types.js';

export class WeCimaProvider extends BaseProvider {
  id = 'wecima';
  name = 'WeCima';
  lang = 'ar';
  mainUrl = 'https://wecima.cx';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url: string | undefined, base: string): string {
    if (!url) return '';
    try { return new URL(url, base).toString(); } catch { return url; }
  }

  private contentOrigin(id: string): string {
    const normalized = id.startsWith(`${this.id}:`) ? id.slice(this.id.length + 1) : id;
    try { return new URL(normalized).origin; } catch { return this.mainUrl; }
  }

  private parseItems(resp: Awaited<ReturnType<typeof this.http.get>>, baseUrl: string): ProviderItem[] {
    const out = new Map<string, ProviderItem>();
    resp.$('a[href]').each((_, el) => {
      const href = resp.$(el).attr('href');
      if (!href) return;
      const url = this.fixUrl(href, baseUrl);
      let type: StremioContentType | null = null;
      if (/\/series\//i.test(url) || /episodes\.php/i.test(url)) type = 'series';
      else if (/\/watch\//i.test(url) || /movies\.php/i.test(url)) type = 'movie';
      if (!type) return;
      const title = resp.$(el).attr('title')?.trim() || resp.$(el).find('h2,h3,.title,.post-title').first().text().trim() || resp.$(el).text().trim();
      if (!title) return;
      const img = resp.$(el).find('img').first();
      const poster = this.fixUrl(img.attr('data-src') || img.attr('src'), baseUrl);
      out.set(url, { id: this.formatId(url), provider: this.name, type, title, poster, url });
    });
    return [...out.values()];
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      for (const url of [`${baseUrl}/?s=${encodeURIComponent(query)}`, `${baseUrl}/search.php?keyword=${encodeURIComponent(query)}`]) {
        try {
          const resp = await this.http.get(url);
          const items = this.parseItems(resp, baseUrl);
          if (items.length) return { value: items, identityVerified: true };
        } catch { /* try compatible fallback */ }
      }
      return { value: [], identityVerified: false };
    });
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const modern = page > 1 ? `${baseUrl}/page/${page}/` : `${baseUrl}/`;
      const legacy = type === 'series' ? `${baseUrl}/episodes.php${page > 1 ? `?page=${page}` : ''}` : `${baseUrl}/movies.php${page > 1 ? `?page=${page}` : ''}`;
      for (const url of [modern, legacy]) {
        try {
          const resp = await this.http.get(url);
          const items = this.parseItems(resp, baseUrl).filter((item) => item.type === type);
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
    const episodes: ProviderEpisode[] | undefined = type === 'series' ? this.parseItems(resp, origin)
      .filter((item) => item.type === 'series' || /حلقة|episode/i.test(item.title))
      .map((item, index) => ({ id: item.id, title: item.title, season: 1, episode: index + 1, url: item.url })) : undefined;
    return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl, episodes };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetId = episodeId || contentId;
    const normalized = targetId.startsWith(`${this.id}:`) ? targetId.slice(this.id.length + 1) : targetId;
    const origin = this.contentOrigin(normalized);
    const fullUrl = this.fixUrl(normalized, origin);
    const streams: ResolvedStream[] = [];
    const vidMatch = fullUrl.match(/vid=([a-zA-Z0-9]+)/);
    const playUrl = vidMatch ? `${origin}/play.php?vid=${vidMatch[1]}` : fullUrl;
    try {
      const playRes = await this.http.get(playUrl, { headers: { Referer: fullUrl } });
      const iframes: string[] = [];
      playRes.$('iframe').each((_, ifr) => { const src = playRes.$(ifr).attr('src'); if (src) iframes.push(this.fixUrl(src, origin)); });
      playRes.$('source[src],video[src]').each((_, el) => {
        const src = playRes.$(el).attr('src');
        if (src) streams.push({ url: this.fixUrl(src, origin), name: this.name, headers: { Referer: fullUrl } });
      });
      for (const iframe of iframes) streams.push({ url: iframe, name: this.name, headers: { Referer: fullUrl } });
    } catch { return []; }
    return streams;
  }
}
