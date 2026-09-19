import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { safeBase64Decode } from '../../utils/crypto.js';
import { unpackAll } from '../../utils/packer.js';
import { extractStreams } from '../../extractors/index.js';

export class ThreeIskProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = '3isk';
  name = '3isk - قصة عشق (مسلسلات تركية)';
  lang = 'ar';
  mainUrl = 'https://3iskk.xyz';
  supportedTypes: StremioContentType[] = ['series', 'movie'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url?: string, baseUrl = this.mainUrl): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  private contentOrigin(contentId: string): string {
    if (contentId.startsWith('http')) {
      try { return new URL(contentId).origin; } catch { return this.mainUrl; }
    }
    return this.mainUrl;
  }

  private extractItemUrl(el: any, $: any, baseUrl: string): string {
    const dataClse = $(el).attr('data-clse');
    if (dataClse) {
      const decoded = safeBase64Decode(dataClse);
      if (decoded.startsWith('http') || decoded.startsWith('/')) return this.fixUrl(decoded, baseUrl);
    }
    const href = $(el).find('a').first().attr('href');
    return href ? this.fixUrl(href, baseUrl) : '';
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const resp = await this.http.get(`${baseUrl}/search.php?keywords=${encodeURIComponent(query)}`);
      const items: ProviderItem[] = [];
      resp.$('div.post-item, div.block-post, div.video-item').each((_, el) => {
        const a = resp.$(el).find('a').first();
        const title = resp.$(el).find('.post-title, .title').text().trim() || a.attr('title') || '';
        const href = this.extractItemUrl(el, resp.$, baseUrl);
        if (!title || !href) return;
        const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'), baseUrl);
        const isMovie = href.includes('/movie/') || title.includes('فيلم');
        items.push({ id: this.formatId(href), provider: this.name, type: isMovie ? 'movie' : 'series', title, poster, url: href });
      });
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    return this.withHealthyDomain(async (baseUrl) => {
      const path = type === 'movie' ? 'w-mvs' : 'w-srs';
      const resp = await this.http.get(`${baseUrl}/${path}/${page > 1 ? `page/${page}/` : ''}`);
      const items: ProviderItem[] = [];
      const seenHrefs = new Set<string>();
      resp.$('a[href*="/serie-"], a[href*="/tvshows/"], div.post-item, div.block-post').each((_, el) => {
        const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a').first();
        const title = (resp.$(el).find('.post-title, .title').text().trim() || a.text().trim() || a.attr('title') || '').replace(/\s+/g, ' ').trim();
        const href = a.attr('href');
        if (!title || !href) return;
        const absoluteUrl = this.fixUrl(href, baseUrl);
        if (seenHrefs.has(absoluteUrl)) return;
        seenHrefs.add(absoluteUrl);
        const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src') || a.find('img').attr('src'), baseUrl);
        items.push({ id: this.formatId(absoluteUrl), provider: this.name, type, title, poster, url: absoluteUrl });
      });
      return { value: items, identityVerified: items.length > 0 };
    });
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const baseUrl = this.contentOrigin(contentId);
    const fullUrl = this.fixUrl(contentId, baseUrl);
    const resp = await this.http.get(fullUrl);
    const title = resp.$('h1.entry-title, .post-title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || '3isk Title';
    const poster = this.fixUrl(resp.$('.post-thumbnail img').attr('src') || resp.$('meta[property="og:image"]').attr('content'), baseUrl);
    const description = resp.$('.entry-content p, .story').text().trim();
    const episodes: ProviderEpisode[] = [];
    resp.$('ul.episodes-list li, div.episodes-container a').each((idx, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a');
      const epHref = this.extractItemUrl(el, resp.$, baseUrl) || this.fixUrl(a.attr('href'), baseUrl);
      const epTitle = a.text().trim() || `حلقة ${idx + 1}`;
      if (!epHref) return;
      const match = epTitle.match(/(\d+)/);
      episodes.push({ id: this.formatId(epHref), title: epTitle, season: 1, episode: match ? parseInt(match[1], 10) : idx + 1, url: epHref, poster });
    });
    return { id: this.formatId(fullUrl), provider: this.name, type: type === 'movie' ? 'movie' : 'series', title, poster, description, url: fullUrl, episodes: episodes.length ? episodes : undefined };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetPath = episodeId || contentId;
    const baseUrl = this.contentOrigin(targetPath.startsWith('http') ? targetPath : contentId);
    const fullUrl = this.fixUrl(targetPath, baseUrl);
    const resp = await this.http.get(fullUrl, { headers: { Referer: fullUrl } });
    const streams: ResolvedStream[] = [];
    const form = resp.$('form:has(input[name="news"])').first();
    const actionUrl = this.fixUrl(form.attr('action') || resp.$('form[action*="aa.3isk.icu"]').first().attr('action'), baseUrl);
    const newsVal = form.find('input[name="news"]').attr('value') || '';
    const uVal = form.find('input[name="u"]').attr('value') || '';

    if (actionUrl && newsVal) {
      try {
        const step2Resp = await this.http.post(actionUrl, { form: { news: newsVal, u: uVal }, headers: { Referer: fullUrl } });
        const myUrlMatch = step2Resp.text.match(/var\s+myUrl\s*=\s*['"]([^'"]+)['"]/);
        const nextNewsMatch = step2Resp.text.match(/myInput\.value\s*=\s*['"]([^'"]+)['"]/);
        if (myUrlMatch && nextNewsMatch) {
          const step3Url = this.fixUrl(myUrlMatch[1], new URL(actionUrl).origin);
          const step3Resp = await this.http.post(step3Url, { form: { news: nextNewsMatch[1], u: '' }, headers: { Referer: actionUrl } });
          const embedUrls: string[] = [];
          step3Resp.$('iframe[src*="embed"], iframe[src*="3isk"]').each((_, ifr) => {
            const src = step3Resp.$(ifr).attr('src');
            if (src) embedUrls.push(this.fixUrl(src, new URL(step3Url).origin));
          });
          for (const url of step3Resp.text.match(/https?:\/\/[^'"\s<>]+\/embed\/[^'"\s<>]+/g) || []) if (!embedUrls.includes(url)) embedUrls.push(url);
          for (const embedUrl of embedUrls) {
            try {
              const embedResp = await this.http.get(embedUrl, { headers: { Referer: step3Url } });
              const ukrcdnIfr = embedResp.$('iframe[src*="ukrcdn"]').attr('src') || embedResp.text.match(/https?:\/\/ukrcdn\.[a-z]+\/e\/[a-zA-Z0-9-]+/)?.[0];
              if (ukrcdnIfr) {
                const ukrUrl = this.fixUrl(ukrcdnIfr, new URL(embedUrl).origin);
                const ukrResp = await this.http.get(ukrUrl, { headers: { Referer: embedUrl } });
                const playbackApiMatch = ukrResp.text.match(/fetch\s*\(\s*['"]([^'"]+playback[^'"]*)['"]/);
                if (playbackApiMatch) {
                  const playbackUrl = this.fixUrl(playbackApiMatch[1].replace(/\\\//g, '/'), new URL(ukrUrl).origin);
                  const pbResp = await this.http.get(playbackUrl, { headers: { Referer: ukrUrl, Accept: 'application/json' } });
                  try {
                    const pbJson = JSON.parse(pbResp.text);
                    if (typeof pbJson.url === 'string' && /^https?:\/\//i.test(pbJson.url)) streams.push({ name: '3isk - سيرفر قصة عشق (HLS)', quality: '1080p / 720p', url: pbJson.url, isM3u8: true, headers: { Referer: new URL(ukrUrl).origin + '/' } });
                  } catch (e) { this.logger.debug(`Error parsing ukrcdn playback JSON: ${(e as Error).message}`); }
                }
              }
              const unpacked = unpackAll(embedResp.text, embedUrl);
              const m3u8 = unpacked.match(/https?:\/\/[^'"\s\\]+?\.m3u8[^'"\s\\]*/)?.[0]?.replace(/\\\//g, '/');
              if (m3u8 && /^https?:\/\//i.test(m3u8)) streams.push({ name: '3isk Server', url: m3u8, isM3u8: true, headers: { Referer: embedUrl } });
            } catch (err) { this.logger.debug(`Error fetching embed ${embedUrl}: ${(err as Error).message}`); }
          }
        }
      } catch (err) { this.logger.error(`Error during 3isk handshake: ${(err as Error).message}`); }
    }

    if (streams.length === 0) {
      const iframes: string[] = [];
      resp.$('iframe[src]').each((_, ifr) => { const src = resp.$(ifr).attr('src'); if (src) iframes.push(this.fixUrl(src, baseUrl)); });
      for (const ifrUrl of iframes) {
        try { streams.push(...(await extractStreams(ifrUrl, fullUrl)).filter((stream) => /^https?:\/\//i.test(stream.url))); } catch {}
      }
    }
    return streams.filter((stream) => /^https?:\/\//i.test(stream.url));
  }
}
