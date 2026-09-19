import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class AkwamProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'akwam';
  name = 'Akwam (أكوام)';
  lang = 'ar';
  mainUrl = 'https://ak.sv';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  private async withContentDomain<T>(contentId: string, attempt: (baseUrl: string, fullUrl: string) => Promise<T>): Promise<T> {
    if (/^https?:\/\//i.test(contentId)) {
      const parsed = new URL(contentId);
      return attempt(parsed.origin, contentId);
    }
    return this.withHealthyDomain(async (baseUrl) => {
      const value = await attempt(baseUrl, this.fixUrl(contentId, baseUrl));
      return { value, identityVerified: value !== null && (!Array.isArray(value) || value.length > 0) };
    });
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const url = `${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}`;
      const resp = await this.http.get(url);
      const items: ProviderItem[] = [];
      resp.$('div.col-lg-auto.col-md-4.col-6, div.widget-body div.entry-box').each((_, el) => {
        const titleEl = resp.$(el).find('h3.entry-title a, .entry-title a');
        const title = titleEl.text().trim();
        const href = resp.$(el).find('a').first().attr('href') || titleEl.attr('href');
        if (!title || !href) return;
        const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
        const isSeries = href.includes('/series/') || title.includes('مسلسل');
        const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
        items.push({ id: this.formatId(this.fixUrl(href, baseUrl)), provider: this.name, type: isSeries ? 'series' : 'movie', title, poster, year: yearMatch ? parseInt(yearMatch[1], 10) : undefined, url: this.fixUrl(href, baseUrl) });
      });
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'series' ? 'series' : 'movies';
      const url = `${baseUrl.replace(/\/$/, '')}/${path}${page > 1 ? `?page=${page}` : ''}`;
      const resp = await this.http.get(url);
      const items: ProviderItem[] = [];
      resp.$('div.col-lg-auto.col-md-4.col-6, div.widget-body div.entry-box').each((_, el) => {
        const titleEl = resp.$(el).find('h3.entry-title a, .entry-title a');
        const title = titleEl.text().trim();
        const href = resp.$(el).find('a').first().attr('href') || titleEl.attr('href');
        if (!title || !href) return;
        const absolute = this.fixUrl(href, baseUrl);
        const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
        const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
        items.push({ id: this.formatId(absolute), provider: this.name, type, title, poster, year: yearMatch ? parseInt(yearMatch[1], 10) : undefined, url: absolute });
      });
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    return this.withContentDomain(contentId, async (baseUrl, fullUrl) => {
      const resp = await this.http.get(fullUrl);
      const title = resp.$('h1.entry-title').text().trim() || resp.$('meta[property="og:title"]').attr('content')?.trim();
      if (!title) return null;
      const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.picture img').attr('src'), baseUrl);
      const description = resp.$('.widget-body p.text-white').text().trim() || resp.$('meta[name="description"]').attr('content');
      const episodes: ProviderEpisode[] = [];
      if (type === 'series') {
        resp.$('div.widget-body div.entry-box').each((idx, el) => {
          const epLink = resp.$(el).find('a').attr('href');
          const epTitle = resp.$(el).find('.entry-title').text().trim() || `حلقة ${idx + 1}`;
          if (!epLink) return;
          const absolute = this.fixUrl(epLink, baseUrl);
          const epNumMatch = epTitle.match(/حلقة\s*(\d+)/i) || epLink.match(/episode-(\d+)/i);
          const seasonNumMatch = epTitle.match(/موسم\s*(\d+)/i) || fullUrl.match(/season-(\d+)/i);
          episodes.push({ id: this.formatId(absolute), title: epTitle, season: seasonNumMatch ? parseInt(seasonNumMatch[1], 10) : 1, episode: epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1, url: absolute, poster });
        });
      }
      return { id: this.formatId(fullUrl), provider: this.name, type, title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined };
    });
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const target = episodeId || contentId;
    return this.withContentDomain(target, async (baseUrl, fullUrl) => {
      const resp = await this.http.get(fullUrl);
      const streams: ResolvedStream[] = [];
      const directLinks: string[] = [];
      resp.$('a.link-btn[href*="/watch/"], a.link-btn[href*="/download/"]').each((_, el) => {
        const link = resp.$(el).attr('href');
        if (link) directLinks.push(this.fixUrl(link, baseUrl));
      });
      for (const dl of directLinks) {
        try {
          const dlResp = await this.http.get(dl, { referer: fullUrl });
          streams.push(...await extractStreams(dl, fullUrl));
          dlResp.$('a[href*=".mp4"], a[href*=".m3u8"]').each((_, a) => {
            const streamUrl = dlResp.$(a).attr('href');
            if (streamUrl) streams.push({ name: 'Akwam Direct', url: streamUrl, isM3u8: streamUrl.includes('.m3u8'), headers: { Referer: dl } });
          });
        } catch (e) {
          this.logger.debug(`Error fetching Akwam playback page: ${(e as Error).message}`);
        }
      }
      return streams.filter(s => /^https?:\/\//i.test(s.url));
    });
  }
}
