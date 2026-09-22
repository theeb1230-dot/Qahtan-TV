# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `e5bfcad7801f17d2cd99edde63125fc61ddf06de`.
- Exact-head CI run `35716073054` completed red. Install, lint, tests, build, Akwam E2E, Yacine E2E and the exact WeCima degraded contract all passed.
- The independent strict outcome gates now prove both ArabSeed and FaselHD runtime commands failed on this exact head. Their collection steps display success because GitHub normalizes `continue-on-error`, but `steps.<id>.outcome` is `failure`, therefore both explicit require steps failed. Neither provider is promoted or waived.
- To avoid spending later runs behind the same two external/runtime blockers, commit `7a0d6307b9a59ba4596d1d74f8df97c66ed77045` extends the same strict independent evidence pattern to Anime4Up, WitAnime, 3isk and EgyDead. Each provider executes even if another fails; each has its own mandatory require gate. This collects P0-7 evidence without weakening P0-5/P0-6.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. ArabSeed E2E: strict runtime currently fails; prove search/catalog -> meta/details -> safe non-empty stream, then series/episodes capability before Working.
2. FaselHD E2E: strict runtime currently fails; prior hosted evidence includes external HTTP 403 on registered origins.
3. Anime4Up, WitAnime, 3isk, EgyDead: new independent strict runtime gates pending exact-head evidence.
4. SyriaLive independent source/contract proof or remain Broken/degraded.
5. Tuktuk candidate remains quarantined pending identity/content/parser proof.
6. Stream/extractor and backend security closure: SSRF, redirects, DNS rebinding, URL credentials/schemes, isolation, limits, CORS, PORT, streaming backpressure and Range/206.
7. Stremio manifest -> catalog -> meta -> stream live regression.
8. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependencies; TODO/FIXME/dead code; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from current evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Open: ArabSeed full stream plus series/episodes proof; FaselHD full E2E; Anime4Up/WitAnime/3isk/EgyDead full E2E; security/Stremio/release gates.
- No `streams=0` waiver. `continue-on-error` is used only to collect all provider evidence in one run; each provider has a separate strict require step and any failure keeps CI red.

## CI / tests / artifacts
- Run `35716073054` on `e5bfcad7801f17d2cd99edde63125fc61ddf06de`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact degraded contract green; both ArabSeed and FaselHD strict require gates red.
- Commit `7a0d6307b9a59ba4596d1d74f8df97c66ed77045`: added independent collection + strict require gates for Anime4Up, WitAnime, 3isk and EgyDead while retaining ArabSeed/FaselHD gates.
- Exact-head CI for `7a0d6307...` was not yet available at inspection, so no provider/runtime completion credit is added from this workflow change.
- Releases/artifacts: none release-ready.

## Provider/domain health
- Working on current completed runtime evidence: Akwam, Yacine TV.
- Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead.
- Broken/degraded: WeCima (verified Cloudflare challenge only), SyriaLive.
- Quarantined and excluded from ten-provider denominator: Tuktuk candidate.

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
- ArabSeed and FaselHD both fail strict E2E on run `35716073054`; neither is Working.
- Exact failure stage text is not exposed by the available Actions job metadata, so no parser/stream root cause is invented from missing logs.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Read exact-head CI after `7a0d6307...` to classify Anime4Up, WitAnime, 3isk and EgyDead independently while retaining the proven ArabSeed/FaselHD failures. Fix the highest actionable code defect shown by provider-specific evidence; external access blocks remain unverified/degraded rather than receiving waivers. Then continue security and Stremio P0 gates.
