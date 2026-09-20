import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { HttpClient } from '../../utils/http.js';
import { decryptYacine } from '../../utils/crypto.js';

export class YacineTVProvider extends BaseProvider {
  private readonly http = new HttpClient();
  id = 'yacinetv';
  name = 'Yacine TV (بث مباشر)';
  lang = 'ar';
  mainUrl = 'https://yacinee-tv.net';
  supportedTypes: StremioContentType[] = ['tv', 'channel'];

  constructor() { super(); this.initLogger(); }

  private async fetchApi(path: string): Promise<any> {
    return this.withHealthyDomain(async (baseUrl) => {
      const fullUrl = `${baseUrl.replace(/\/$/, '')}/${path}`.replace(/([^:]\/)\/+/g, '$1');
      const started = Date.now();
      const resp = await this.http.get(fullUrl, { headers: { 'User-Agent': 'okhttp/4.12.0' }, timeout: 8000 });
      if (resp.status !== 200) throw new Error(`Yacine API HTTP ${resp.status}`);
      const tHeader = resp.headers['t'] || '';
      const decrypted = decryptYacine(resp.text, tHeader);
      if (!decrypted) throw new Error('Yacine API decrypt contract failed');
      let parsed: any;
      try { parsed = JSON.parse(decrypted); } catch { throw new Error('Yacine API JSON contract failed'); }
      const identityVerified = parsed && typeof parsed === 'object' && ('data' in parsed || 'status' in parsed || 'success' in parsed);
      if (!identityVerified) throw new Error('Yacine API identity contract failed');
      this.logger.debug(`Verified Yacine API ${baseUrl} in ${Date.now() - started}ms`);
      return { value: parsed, identityVerified: true };
    });
  }

  private itemUrl(kind: 'event'|'channel', id: string | number): string { return `${this.mainUrl}/${kind}/${id}`; }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const q = query.toLowerCase(); const results: ProviderItem[] = [];
    try {
      const events = (await this.fetchApi('events'))?.data || [];
      for (const ev of events) {
        const t1=ev.team_1?.name||'', t2=ev.team_2?.name||'', champ=ev.champions||'', title=`${t1} vs ${t2}`;
        if ([t1,t2,champ,title].some(v=>v.toLowerCase().includes(q))) results.push({ id:this.formatId(`event:${ev.id}`), provider:this.name, type:'tv', title:`⚽ ${title} (${champ})`, poster:ev.team_1?.logo||ev.team_2?.logo, description:`🏆 ${champ} | 📺 ${ev.channel||'بث مباشر'}`, url:this.itemUrl('event',ev.id) });
      }
    } catch {}
    const categories=(await this.fetchApi('categories'))?.data||[];
    for (const cat of categories) {
      const channels=(await this.fetchApi(`categories/${cat.id}/channels`))?.data||[];
      for (const ch of channels) if (ch.name?.toLowerCase().includes(q)) results.push({ id:this.formatId(String(ch.id)), provider:this.name, type:'tv', title:ch.name||'قناة', poster:ch.logo, description:`بث مباشر لقناة ${ch.name}`, url:this.itemUrl('channel',ch.id) });
    }
    return results;
  }

  async getCatalogInternal(_type: StremioContentType, _page=1): Promise<ProviderItem[]> {
    const results: ProviderItem[]=[];
    try {
      const events=(await this.fetchApi('events'))?.data||[];
      for (const ev of events) { const t1=ev.team_1?.name||'فريق 1', t2=ev.team_2?.name||'فريق 2', champ=ev.champions||'مباراة مباشرة'; results.push({ id:this.formatId(`event:${ev.id}`), provider:this.name, type:'tv', title:`⚽ ${t1} vs ${t2} - ${champ}`, poster:ev.team_1?.logo||ev.team_2?.logo, description:`🏆 ${champ} | 📺 ${ev.channel||'بث مباشر'}`, url:this.itemUrl('event',ev.id) }); }
    } catch (e) { this.logger.debug(`Error fetching events: ${(e as Error).message}`); }
    const categories=(await this.fetchApi('categories'))?.data||[];
    for (const cat of categories.slice(0,6)) { const channels=(await this.fetchApi(`categories/${cat.id}/channels`))?.data||[]; for (const ch of channels) results.push({ id:this.formatId(String(ch.id)), provider:this.name, type:'tv', title:ch.name||'قناة', poster:ch.logo, description:`قسم ${cat.name} - بث مباشر`, url:this.itemUrl('channel',ch.id) }); }
    return results;
  }

  async getMetaInternal(contentId: string, _type: StremioContentType): Promise<ProviderDetail|null> {
    if (contentId.startsWith('event:')) { const id=contentId.slice(6); const events=(await this.fetchApi('events'))?.data||[]; const ev=events.find((e:any)=>String(e.id)===id); if (!ev) return null; return { id:this.formatId(contentId), provider:this.name, type:'tv', title:`⚽ ${ev.team_1?.name||''} vs ${ev.team_2?.name||''}`, poster:ev.team_1?.logo||ev.team_2?.logo, description:`🏆 ${ev.champions||''}\n📺 ${ev.channel||'بث مباشر'}`, url:this.itemUrl('event',id) }; }
    const streams=(await this.fetchApi(`channel/${contentId}`))?.data||[]; const first=streams[0];
    if (!first) return null;
    return { id:this.formatId(contentId), provider:this.name, type:'tv', title:first.name||`قناة ${contentId}`, poster:first.logo, description:`شاهد البث المباشر لقناة ${first.name||contentId}`, url:this.itemUrl('channel',contentId) };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType): Promise<ResolvedStream[]> {
    const endpoint=contentId.startsWith('event:')?`event/${contentId.slice(6)}`:`channel/${contentId}`;
    const streams=(await this.fetchApi(endpoint))?.data||[]; const resolved:ResolvedStream[]=[];
    for (const stream of streams) {
      const finalUrl=stream.url?.replace('www.elahmad.coo','www.elahmad.com')||'';
      if (!/^https?:\/\//i.test(finalUrl)) continue;
      const headers:Record<string,string>={'User-Agent':stream.user_agent||'okhttp/4.12.0'};
      if (stream.referer) headers.Referer=stream.referer;
      if (stream.headers&&typeof stream.headers==='object') for (const [k,v] of Object.entries(stream.headers)) if (typeof v==='string') headers[k]=v;
      resolved.push({ name:`Yacine TV - ${stream.name||'Live'}`, quality:stream.name||'Live HD', url:finalUrl, isM3u8:true, headers });
    }
    return resolved;
  }
}
