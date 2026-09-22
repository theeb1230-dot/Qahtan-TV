# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `443cfbab26aa95cd7ab7008fbcdcae7af01cf9b7`.
- Exact-head CI run `35754162973` completed red. Install, lint, tests, build, Akwam E2E, Yacine E2E and the exact WeCima degraded contract passed. Independent strict require gates prove ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead all failed runtime acceptance on this head.
- Fresh first-party Anime4Up evidence confirms the canonical origin redirects to `/home8/`, the live catalog exposes `/anime/` items, detail pages expose episodes, and episode pages expose multiple playback servers. The remaining stream parser only accepted absolute legacy server URLs. Commit `a6ebeb3d62849815f77f53556e5281a4bb09ace9` now normalizes protocol-relative and same-origin player URLs and also feeds first-party iframe sources into the generic extractor, while retaining safe HTTP(S)-only output.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. Anime4Up exact-head E2E after player URL/iframe normalization; acceptance remains search/catalog -> meta -> episodes -> safe non-empty stream.
2. ArabSeed E2E: strict runtime fails; prove full movie and series/episodes capability before Working.
3. FaselHD E2E: strict runtime fails; prior hosted evidence includes external HTTP 403 on registered origins.
4. WitAnime, 3isk, EgyDead strict runtime failures require provider-specific diagnosis.
5. SyriaLive independent source/contract proof or remain Broken/degraded.
6. Tuktuk candidate remains quarantined pending identity/content/parser proof.
7. Stream/extractor and backend security closure: SSRF, redirects, DNS rebinding, URL credentials/schemes, isolation, limits, CORS, PORT, streaming backpressure and Range/206.
8. Stremio manifest -> catalog -> meta -> stream live regression.
9. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependencies; TODO/FIXME/dead code; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from current evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Open: ArabSeed full stream plus series/episodes proof; FaselHD full E2E; Anime4Up/WitAnime/3isk/EgyDead full E2E; security/Stremio/release gates.
- No `streams=0` waiver. `continue-on-error` is used only to collect all provider evidence in one run; each provider has a separate strict require step and any failure keeps CI red.

## CI / tests / artifacts
- Run `35754162973` on `443cfbab26aa95cd7ab7008fbcdcae7af01cf9b7`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact degraded contract green; ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead strict require gates red.
- Commit `a6ebeb3d62849815f77f53556e5281a4bb09ace9`: Anime4Up player URL normalization and iframe-source extraction. Exact-head CI pending at state update, therefore no runtime completion credit yet.
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
- Six strict provider gates remain red on completed exact-head run `35754162973`; none is promoted without full stream evidence.
- Anime4Up first-party content is live and exposes multiple player servers, but player URL normalization/iframe extraction is not credited until exact-head E2E passes.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Read exact-head CI after Anime4Up player URL/iframe normalization. If Anime4Up reaches safe non-empty stream, promote it only from that evidence; otherwise diagnose the next exact stage. Continue with the highest actionable defect among WitAnime/3isk/EgyDead, while external access blocks remain degraded rather than waived. Then continue security and Stremio P0 gates.
