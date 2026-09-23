# Autonomous Development State

## Current cycle
- Start/main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; work remains on this branch only. PR is open and currently mergeable at inspection.
- Cycle-start PR head: `61e7abacf43d227a573d8db4048b4d7aebb43677`.
- Latest completed exact-head CI: run `35786758562` on `61e7abacf43d227a573d8db4048b4d7aebb43677` completed red. install/lint/tests/build, Akwam E2E, Yacine E2E, WeCima exact degraded contract and all provider evidence collection steps completed; strict require gates for ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead failed.
- Akwam/Yacine runtime evidence remains valid on the latest completed run. Akwam resolved a safe non-empty stream through bounded candidate fallback; Yacine resolved a safe non-empty stream. No `streams=0` waiver exists.
- New code change on this cycle: commit `fff18f38b41e331cdc2a79e9bc4f88b997f22743` updates ArabSeed's first-party home fallback query semantics. Generic queries such as `مسلسل/مسلسلات/series/tv` now act as series filters and `فيلم/افلام/movie/movies/film` as movie filters instead of being treated as literal title tokens. Specific title terms remain strict token matches. This fixes a real fallback contract bug without bypassing challenged category/search paths.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers ordered by release impact
### P0
1. Exact-head CI for `fff18f38b41e331cdc2a79e9bc4f88b997f22743`, then ArabSeed must prove discovery/catalog -> metadata -> episodes when applicable -> safe non-empty stream. No degraded waiver for runtime success.
2. FaselHD, Anime4Up, WitAnime, 3isk and EgyDead full E2E with evidence-based classification. A provider is not Working from HTTP 200 alone.
3. WeCima must remain degraded only for the specific verified Cloudflare challenge contract; no bypass.
4. SyriaLive independent source/contract proof or remain Broken/degraded; never alias Yacine.
5. Tuktuk candidate remains quarantined pending identity/content/parser proof.
6. Backend security closure: SSRF, redirect/DNS rebinding, URL credentials/schemes, cookie isolation, bounded timeouts/retries/body limits, production CORS/PORT, streaming backpressure and Range/206.
7. Stremio manifest -> catalog -> meta -> stream live regression.
8. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependencies; TODO/FIXME/dead code; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from current completed evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Open: ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead full E2E; remaining security/Stremio/release gates.
- The ArabSeed code change only improves fallback query semantics and does not bypass WAF/challenge-protected category/search paths.

## CI / tests / artifacts
- Run `35786758562` on `61e7abacf43d227a573d8db4048b4d7aebb43677`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact degraded contract green; ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead strict require gates red.
- Commit `fff18f38b41e331cdc2a79e9bc4f88b997f22743`: ArabSeed generic-query semantic fallback correction. Exact-head CI for this new head is not yet available at state update, so it receives no runtime completion credit.
- Releases/artifacts: none release-ready.

## Provider/domain health
- Working on completed runtime evidence: Akwam, Yacine TV.
- Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead.
- Broken/degraded: WeCima (verified Cloudflare challenge only), SyriaLive.
- Quarantined and excluded from the ten-provider denominator: Tuktuk candidate.

## Weighted verified completion
| Category | Weight | Verified fraction | Earned |
|---|---:|---:|---:|
| Repo/build/CI baseline | 5 | 0.90 | 4.5 |
| Qahtan identity + provenance/licenses | 5 | 0.45 | 2.3 |
| DomainRegistry + identity verification + failover | 12 | 0.75 | 9.0 |
| Provider health/circuit/ranking/cache | 10 | 0.75 | 7.5 |
| Backend/network/proxy security | 13 | 0.75 | 9.8 |
| Discovery/catalog/search coverage | 8 | 0.62 | 5.0 |
| Metadata/details + seasons/episodes | 8 | 0.62 | 5.0 |
| Stream resolution/extractors | 10 | 0.55 | 5.5 |
| End-to-end provider runtime evidence | 15 | 0.20 | 3.0 |
| Stremio compatibility/regression | 4 | 0.60 | 2.4 |
| Observability/performance/error isolation | 3 | 0.60 | 1.8 |
| Release gate/artifact/runtime readiness | 7 | 0.40 | 2.8 |

**A) Overall Verified Product Completion: 58.4%.**

**B) Runtime-Verified Provider Completion: 2/10 = 20.0%.** Working: Akwam, Yacine TV. Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead. Broken/degraded: WeCima, SyriaLive.

**C) Release Gate Completion: 3/7 = 42.9%.** Fixed denominator seven.

**D) Beta Readiness: 55.0%.** Broad provider/runtime and release gates remain open.

## Risks / what does not work
- Six strict provider gates remain red on the latest completed exact-head run; none is promoted without full stream evidence.
- The new ArabSeed fallback correction is uncredited until its exact-head CI proves the full runtime path.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, Stremio runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Inspect exact-head CI for `fff18f38b41e331cdc2a79e9bc4f88b997f22743`. If ArabSeed reaches safe non-empty stream, promote it and keep all other gates unchanged. Otherwise use the first precise failure stage, not broad provider labels, to fix the next highest shared defect, then continue security and Stremio P0 gates.
