# Autonomous Development State

## Current cycle
- Start/main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; all work remains on this branch only.
- Current PR head after this cycle: `8bdcf452293482878ef8d879a5734e715dd86e85`.
- Exact-head workflow inspected before this cycle: run `35843269170`, merge ref `b5de74485af6db749018777fa59935fe89594b86`, completed `failure`.
- Static gates were green: npm install, TypeScript lint, 26/26 tests, production build, network/security contracts, provider-health/circuit-breaker checks and request-coalescing checks.
- Runtime outcomes: Akwam `Working` with 5 safe streams; Yacine TV `Working` with 3 safe streams; WeCima correctly degraded under the explicit Cloudflare contract; ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead remained strict failures.

## Blockers ordered by release impact
### P0
1. FaselHD remains unresolved, but the prior probe was using the redirected request path (`/main/wp-sitemap.xml`) instead of the effective site origin. The current fix now normalizes to `landing.url` origin and inspects same-host landing-page content links before sitemap fallback. Acceptance remains identity -> parser prerequisites -> discovery/catalog -> metadata/details -> episodes when applicable -> safe non-empty HTTP(S) streams.
2. ArabSeed is home-reachable but category paths return a Cloudflare challenge; do not bypass or classify as Working.
3. Anime4Up, WitAnime, 3isk and EgyDead fail identity verification on the hosted runner; each needs independent evidence before promotion.
4. WeCima must remain degraded only for verified `403 + cf-mitigated=challenge` on `wecima.cx`; no waiver or bypass.
5. SyriaLive needs independent source/contract proof or stays Broken/degraded; never alias Yacine.
6. Tuktuk candidate remains quarantined pending identity/content/parser proof.
7. Backend security closure: SSRF, redirect/DNS rebinding, URL credentials/schemes, cookie isolation, bounded timeouts/retries/body limits, production CORS/PORT, streaming backpressure and Range/206.
8. Stremio manifest -> catalog -> meta -> stream live regression.
9. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependency and TODO/FIXME/dead-code audit; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from completed evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation; compile regression on ArabSeed registry config fixed.
- Open: FaselHD full runtime proof; ArabSeed and the remaining strict provider E2E gates; security/Stremio/release gates.
- No provider promotion or CI waiver is introduced by the FaselHD contract expansion.

## Work performed this cycle
- Re-read repository metadata, PR #26, exact-head workflow `35843269170`, job `107123200804`, and full logs.
- Confirmed the latest FaselHD failure was partly self-inflicted by constructing sitemap probes from the redirected path (`/main/...`) rather than the effective origin.
- Updated `src/providers/faselhd/index.ts` to:
  - normalize redirects to `new URL(landing.url).origin`;
  - scan same-host landing-page anchors for `/video/`, `/watch/`, `/series/`, `/movie/`, `/post/`, `watch.php` and `vid/id` query candidates;
  - retain strict same-host brand/parser checks and safe-stream requirements;
  - keep the candidate quarantined and fail closed.

## CI / tests / artifacts
- Pre-change exact-head run `35843269170` on merge ref `b5de74485af6db749018777fa59935fe89594b86`: install, lint, tests, build and contract checks green; provider outcome steps executed independently.
- Akwam output: `status=Working`, catalog 24, metadata true, episodes 2, streams 5, unsafe streams 0.
- Yacine output: `status=Working`, catalog 216, metadata true, streams 3, unsafe streams 0.
- WeCima output: `status=Broken`, `expectedDegraded=true`, reason `cloudflare-challenge`, status 403, finalHost `wecima.cx`, content type `text/html`, `cf-mitigated=challenge`, title `Just a moment...`, brand fingerprint true.
- ArabSeed output: home status 200 and brand fingerprint true, but film/TV paths return 403 Cloudflare challenge; classification `home-reachable-category-paths-challenged`.
- FaselHD output before this fix: legacy domains return 403; `fasellhd.baby` returns status 200, finalHost `fasellhd.baby`, brand=true, parserContract=false; probes incorrectly used `/main/...` and returned zero parsed locations.
- Anime4Up, WitAnime, 3isk and EgyDead all failed identity verification and returned no runtime catalog item.
- Strict require steps failed for ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead as intended. No waiver was added.
- Releases/artifacts: none release-ready.

## Provider/domain health
- Working on completed runtime evidence: Akwam, Yacine TV.
- Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead.
- Broken/degraded: WeCima (verified Cloudflare challenge only), SyriaLive.
- Quarantined and excluded from the ten-provider denominator: Tuktuk candidate; FaselHD `fasellhd.rest/main` candidate and its redirected `fasellhd.baby` origin.

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
- Six strict provider gates remain open; none is promoted without full stream evidence.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; ArabSeed category paths are challenged; SyriaLive independence remains unproven.
- FaselHD branding is proven on `fasellhd.baby`, but parser/content discovery is still unproven; previous sitemap probing used the redirected path and has now been corrected to origin-aware probing. No stream evidence exists yet.
- Security closure, Stremio runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. The next useful work unit is to run exact-head CI on `8bdcf452293482878ef8d879a5734e715dd86e85` and inspect whether origin-aware landing candidates or root-relative sitemap probes expose a real FaselHD content item. If identity still fails, explicitly reject the candidate and stop spending P0 time on it. Continue strict runtime gates without waivers and do not merge until exact-head CI is green and the PR is mergeable.
