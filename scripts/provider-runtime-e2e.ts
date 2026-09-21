import { registry } from '../src/providers/index.js';
import { StremioContentType } from '../src/types/stremio.js';

const providerId = process.argv[2];
const query = process.argv.slice(3).join(' ') || 'مسلسل';
const expectedDegradedReason = process.env.EXPECT_DEGRADED_REASON;
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
  expectedDegraded?: boolean;
  degradedReason?: string;
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

  const candidates = [...search];
  if (candidates.length) {
    const catalog = await provider.getCatalog(candidates[0].type, 1);
    evidence.catalog = catalog.length;
    for (const item of catalog) {
      if (!candidates.some((candidate) => candidate.id === item.id)) candidates.push(item);
    }
  } else {
    for (const type of provider.supportedTypes) {
      const catalog = await provider.getCatalog(type, 1);
      evidence.catalog += catalog.length;
      for (const item of catalog) {
        if (!candidates.some((candidate) => candidate.id === item.id)) candidates.push(item);
      }
    }
  }

  if (!candidates.length) throw new Error('no runtime search/catalog item');

  // A live catalog can contain a temporarily broken title even while the provider is
  // healthy. Prove the provider against a small bounded sample instead of allowing
  // the first arbitrary search result to become a single-title availability oracle.
  // The gate still requires one real metadata -> episodes (for series) -> safe stream
  // path; failures are not waived and the sample is deliberately capped.
  for (const selected of candidates.slice(0, 3)) {
    evidence.selectedId = selected.id;
    evidence.selectedType = selected.type;
    const contentId = selected.id.startsWith(`${providerId}:`) ? selected.id.slice(providerId.length + 1) : selected.id;
    try {
      const meta = await provider.getMeta(contentId, selected.type);
      evidence.meta = evidence.meta || Boolean(meta);
      if (!meta) continue;

      const episodes = meta.episodes || [];
      evidence.episodes = Math.max(evidence.episodes, episodes.length);
      if (selected.type === 'series' && !episodes.length) continue;

      const episodeId = selected.type === 'series'
        ? episodes[0].id.replace(new RegExp(`^${providerId}:`), '')
        : undefined;
      const streams = await provider.getStreams(contentId, selected.type, episodeId);
      const schemesSafe = streams.length > 0 && streams.every((stream) => /^https?:\/\//i.test(stream.url));
      if (!streams.length || !schemesSafe) continue;

      evidence.streams = streams.length;
      evidence.streamSchemesSafe = true;
      evidence.status = 'Working';
      break;
    } catch (candidateError) {
      evidence.error = (candidateError as Error).message;
    }
  }

  if (evidence.status !== 'Working') evidence.status = evidence.meta ? 'Partial' : 'Broken';
} catch (error) {
  evidence.error = (error as Error).message;
  evidence.status = evidence.search > 0 || evidence.catalog > 0 || evidence.meta ? 'Partial' : 'Broken';
}

// When WeCima fails before discovery, capture only non-sensitive response-contract
// facts. This distinguishes parser drift from CDN/WAF denial without logging body,
// cookies, tokens, media URLs, or other provider data.
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

// A provider may be an explicit degraded runtime gate only for a narrowly proven
// external condition. This is not a Working promotion: any different failure,
// parser drift, partial path, or disappearance of the expected condition fails CI.
if (expectedDegradedReason === 'cloudflare-challenge' && providerId === 'wecima' && evidence.status === 'Broken') {
  const diagnostics = evidence.diagnostics || {};
  const isExpectedChallenge = diagnostics.status === 403 && diagnostics.cfMitigated === 'challenge' && diagnostics.finalHost === 'wecima.cx';
  if (isExpectedChallenge) {
    evidence.expectedDegraded = true;
    evidence.degradedReason = 'cloudflare-challenge';
  }
}

console.log(JSON.stringify(evidence, null, 2));
const acceptedExpectedDegraded = evidence.expectedDegraded === true;
process.exit(evidence.status === 'Working' || acceptedExpectedDegraded ? 0 : 1);
