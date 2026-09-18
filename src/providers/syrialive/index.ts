import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { domainRegistry } from '../../domains/registry.js';

/**
 * SyriaLive is intentionally isolated from Yacine TV.
 *
 * The inherited source previously implemented this provider by calling the
 * Yacine API and decrypting Yacine payloads. That made two provider names point
 * at one source and produced false health/results. Until the independent
 * SyriaLive website contract is verified, this provider fails closed instead
 * of silently serving Yacine data under another name.
 */
export class SyriaLiveProvider extends BaseProvider {
  id = 'syrialive';
  name = 'SyriaLive (مباريات اليوم)';
  lang = 'ar';
  mainUrl = domainRegistry.get('syrialive')?.lastKnownGood || 'https://www.mewsry.live';
  supportedTypes: StremioContentType[] = ['tv', 'channel'];

  constructor() {
    super();
    this.initLogger();
  }

  async searchInternal(_query: string): Promise<ProviderItem[]> {
    this.logger.debug('SyriaLive independent parser is not yet verified; returning no synthetic Yacine results');
    return [];
  }

  async getCatalogInternal(_type: StremioContentType, _page = 1): Promise<ProviderItem[]> {
    return [];
  }

  async getMetaInternal(_contentId: string, _type: StremioContentType): Promise<ProviderDetail | null> {
    return null;
  }

  async getStreamsInternal(_contentId: string, _type: StremioContentType): Promise<ResolvedStream[]> {
    return [];
  }
}
