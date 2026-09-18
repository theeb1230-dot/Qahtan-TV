export type DomainHealth = 'unknown' | 'healthy' | 'degraded' | 'dead';

export interface DomainObservation {
  health: DomainHealth;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  latencyMs: number | null;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  identityVerified: boolean;
  reason: string | null;
}

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

const observations = new Map<string, DomainObservation>();
const keyFor = (providerId:string, url:string) => `${providerId}|${url}`;

export class DomainRegistry {
  get(providerId: string): ProviderDomainConfig | undefined { return configs[providerId]; }
  all(): ProviderDomainConfig[] { return Object.values(configs).map(v => ({...v, fallbacks:[...v.fallbacks], candidates:[...v.candidates], identityHints:[...v.identityHints]})); }
  observation(providerId:string, url:string): DomainObservation | undefined {
    const o=observations.get(keyFor(providerId,url)); return o ? {...o} : undefined;
  }
  orderedUrls(providerId: string, now=Date.now()): string[] {
    const c=configs[providerId]; if(!c) return [];
    const urls=[...new Set([c.lastKnownGood,c.primary,...c.fallbacks,...c.candidates].filter((v):v is string=>Boolean(v)))];
    return urls.sort((a,b)=>{
      const oa=observations.get(keyFor(providerId,a)); const ob=observations.get(keyFor(providerId,b));
      const aCooling=oa?.cooldownUntil ? Date.parse(oa.cooldownUntil)>now : false;
      const bCooling=ob?.cooldownUntil ? Date.parse(ob.cooldownUntil)>now : false;
      if(aCooling!==bCooling) return aCooling ? 1 : -1;
      const score=(o?:DomainObservation)=>(o?.identityVerified?100:0)+(o?.health==='healthy'?50:o?.health==='degraded'?10:o?.health==='dead'?-100:0)-(o?.consecutiveFailures||0)*10-(o?.latencyMs||0)/1000;
      return score(ob)-score(oa);
    });
  }
  mark(providerId:string,url:string,health:DomainHealth,checkedAt=new Date().toISOString(),details:{identityVerified?:boolean;latencyMs?:number;reason?:string;cooldownMs?:number}={}):void {
    const c=configs[providerId]; if(!c) return;
    const previous=observations.get(keyFor(providerId,url));
    const success=health==='healthy' && details.identityVerified===true;
    const failures=success ? 0 : (previous?.consecutiveFailures||0)+(health==='dead'||health==='degraded'?1:0);
    const cooldownMs=details.cooldownMs ?? (failures>=3 ? Math.min(300_000,30_000*2**Math.min(failures-3,3)) : 0);
    const obs:DomainObservation={
      health,lastCheckedAt:checkedAt,lastSuccessAt:success?checkedAt:(previous?.lastSuccessAt||null),
      latencyMs:details.latencyMs??null,consecutiveFailures:failures,
      cooldownUntil:cooldownMs?new Date(Date.parse(checkedAt)+cooldownMs).toISOString():null,
      identityVerified:details.identityVerified??false,reason:details.reason??null,
    };
    observations.set(keyFor(providerId,url),obs);
    c.health=health; c.lastCheckedAt=checkedAt;
    // A merely reachable page is never promoted. Identity must be proven.
    if(success) c.lastKnownGood=url;
  }
}
export const domainRegistry = new DomainRegistry();
