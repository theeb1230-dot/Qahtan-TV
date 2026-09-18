export type DomainHealth = 'unknown' | 'healthy' | 'degraded' | 'dead';

export interface ProviderDomainConfig {
  providerId: string;
  primary: string;
  fallbacks: string[];
  candidates: string[];
  lastKnownGood: string | null;
  health: DomainHealth;
  lastCheckedAt: string | null;
  identityHints: string[];
}

const configs: Record<string, ProviderDomainConfig> = {
  akwam: { providerId:'akwam', primary:'https://akwam.ss/one', fallbacks:[], candidates:[], lastKnownGood:'https://akwam.ss/one', health:'unknown', lastCheckedAt:null, identityHints:['akwam'] },
  yacinetv: { providerId:'yacinetv', primary:'https://yacinee-tv.net', fallbacks:[], candidates:['https://def.ycnapi.com/api'], lastKnownGood:'https://yacinee-tv.net', health:'unknown', lastCheckedAt:null, identityHints:['yacine'] },
  syrialive: { providerId:'syrialive', primary:'https://www.mewsry.live', fallbacks:[], candidates:[], lastKnownGood:'https://www.mewsry.live', health:'unknown', lastCheckedAt:null, identityHints:['match','مباراة','مباريات'] },
  wecima: { providerId:'wecima', primary:'https://wecima.cx', fallbacks:[], candidates:[], lastKnownGood:'https://wecima.cx', health:'unknown', lastCheckedAt:null, identityHints:['wecima','وي سيما'] },
  faselhd: { providerId:'faselhd', primary:'https://www.fasel-hd.com', fallbacks:['https://fasellhd.rest/main'], candidates:[], lastKnownGood:'https://www.fasel-hd.com', health:'unknown', lastCheckedAt:null, identityHints:['fasel','فاصل'] },
  arabseed: { providerId:'arabseed', primary:'https://www.arabseed.wine/home/', fallbacks:[], candidates:[], lastKnownGood:'https://www.arabseed.wine/home/', health:'unknown', lastCheckedAt:null, identityHints:['arabseed','عرب سيد'] },
  anime4up: { providerId:'anime4up', primary:'https://w1.anime4up.rest/home8/', fallbacks:[], candidates:[], lastKnownGood:'https://w1.anime4up.rest/home8/', health:'unknown', lastCheckedAt:null, identityHints:['anime4up'] },
  witanime: { providerId:'witanime', primary:'https://witanime.you', fallbacks:['https://ristoanime.me'], candidates:[], lastKnownGood:'https://witanime.you', health:'unknown', lastCheckedAt:null, identityHints:['anime','انمي'] },
  '3isk': { providerId:'3isk', primary:'https://3iskk.xyz', fallbacks:['https://e.3cktv.com'], candidates:[], lastKnownGood:'https://3iskk.xyz', health:'unknown', lastCheckedAt:null, identityHints:['قصة عشق','3isk'] },
  egydead: { providerId:'egydead', primary:'https://tv10.egydead.live/h3/', fallbacks:[], candidates:[], lastKnownGood:'https://tv10.egydead.live/h3/', health:'unknown', lastCheckedAt:null, identityHints:['egydead','ايجي'] },
};

export class DomainRegistry {
  get(providerId: string): ProviderDomainConfig | undefined { return configs[providerId]; }
  all(): ProviderDomainConfig[] { return Object.values(configs).map(v => ({...v, fallbacks:[...v.fallbacks], candidates:[...v.candidates], identityHints:[...v.identityHints]})); }
  orderedUrls(providerId: string): string[] {
    const c=configs[providerId]; if(!c) return [];
    return [...new Set([c.lastKnownGood, c.primary, ...c.fallbacks, ...c.candidates].filter((v): v is string => Boolean(v)))];
  }
  mark(providerId:string, url:string, health:DomainHealth, checkedAt=new Date().toISOString()): void {
    const c=configs[providerId]; if(!c) return;
    c.health=health; c.lastCheckedAt=checkedAt;
    if(health==='healthy') c.lastKnownGood=url;
  }
}
export const domainRegistry = new DomainRegistry();
