import { registry } from '../src/providers/index.js';
import { StremioContentType } from '../src/types/stremio.js';

const providerId = process.argv[2];
const query = process.argv.slice(3).join(' ') || 'مسلسل';
if (!providerId) {
  console.error('usage: npm run e2e:provider -- <provider-id> [query]');
  process.exit(2);
}

const provider = registry.getProvider(providerId);
if (!provider) {
  console.error(JSON.stringify({ providerId, status: 'Broken', reason: 'provider-not-registered' }, null, 2));
  process.exit(2);
}

type Evidence = {
  providerId: string;
  query: string;
  status: 'Working' | 'Partial' | 'Broken';
  search: number;
  catalog: number;
  meta: boolean;
  episodes: number;
  streams: number;
  streamSchemesSafe: boolean;
  selectedId?: string;
  selectedType?: StremioContentType;
  error?: string;
  diagnostics?: Record<string, unknown>;
};

const evidence: Evidence = {
  providerId,
  query,
  status: 'Broken',
  search: 0,
  catalog: 0,
  meta: false,
  episodes: 0,
  streams: 0,
  streamSchemesSafe: false,
};

try {
  const search = await provider.search(query);
  evidence.search = search.length;

  let selected = search[0];
  if (!selected) {
    for (const type of provider.supportedTypes) {
      const catalog = await provider.getCatalog(type, 1);
      evidence.catalog += catalog.length;
      if (!selected && catalog.length) selected = catalog[0];
    }
  } else {
    const catalog = await provider.getCatalog(selected.type, 1);
    evidence.catalog = catalog.length;
  }

  if (!selected) throw new Error('no runtime search/catalog item');
  evidence.selectedId = selected.id;
  evidence.selectedType = selected.type;

  const contentId = selected.id.startsWith(`${providerId}:`) ? selected.id.slice(providerId.length + 1) : selected.id;
  const meta = await provider.getMeta(contentId, selected.type);
  evidence.meta = Boolean(meta);
  if (!meta) throw new Error('metadata resolution returned null');

  const episodes = meta.episodes || [];
  evidence.episodes = episodes.length;
  const episodeId = selected.type === 'series' && episodes.length ? episodes[0].id.replace(new RegExp(`^${providerId}:`), '') : undefined;
  const streams = await provider.getStreams(contentId, selected.type, episodeId);
  evidence.streams = streams.length;
  evidence.streamSchemesSafe = streams.length > 0 && streams.every((stream) => /^https?:\/\//i.test(stream.url));

  const seriesPathComplete = selected.type !== 'series' || episodes.length > 0;
  evidence.status = evidence.search + evidence.catalog > 0 && evidence.meta && seriesPathComplete && evidence.streams > 0 && evidence.streamSchemesSafe
    ? 'Working'
    : 'Partial';
} catch (error) {
  evidence.error = (error as Error).message;
  evidence.status = evidence.search > 0 || evidence.catalog > 0 || evidence.meta ? 'Partial' : 'Broken';
}

// When WeCima fails before discovery, capture only non-sensitive response-contract
// facts. This distinguishes parser drift from CDN/WAF denial without logging body,
// cookies, tokens, media URLs, or other provider data. The gate still fails normally.
if (providerId === 'wecima' && evidence.status !== 'Working') {
  try {
    const response = await fetch('https://wecima.cx/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    evidence.diagnostics = {
      status: response.status,
      finalHost: new URL(response.url).hostname,
      contentType: response.headers.get('content-type')?.split(';')[0] || null,
      cfMitigated: response.headers.get('cf-mitigated') || null,
      bodyBytes: Buffer.byteLength(html),
      title: title.slice(0, 160),
      brandFingerprint: /we\s*cima|wecima|وى\s*سيما|وي\s*سيما|my\s*cima|mycima/i.test(html),
      canonicalSeriesLinks: (html.match(/href=["'][^"']*\/series\//gi) || []).length,
      canonicalMovieLinks: (html.match(/href=["'][^"']*\/movies\//gi) || []).length,
      watchLinks: (html.match(/href=["'][^"']*\/watch\//gi) || []).length,
    };
  } catch (diagnosticError) {
    evidence.diagnostics = { requestError: (diagnosticError as Error).message };
  }
}

console.log(JSON.stringify(evidence, null, 2));
process.exit(evidence.status === 'Working' ? 0 : 1);
