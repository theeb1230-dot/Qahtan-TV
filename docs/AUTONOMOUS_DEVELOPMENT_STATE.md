# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `3c74669a418a239c62a3b6b8c74f72030a672a00`.
- Exact-head CI run `35760956034` on that head completed red. Install, lint, tests, build, Akwam E2E, Yacine E2E and the exact WeCima degraded contract passed. Strict require gates for ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead all failed.
- P0-10 root-layer work: commit `9e2231c8a4ac28e839b3674ffccb389f66695fb5` strengthens the generic extractor instead of adding another provider-only patch. It resolves relative/protocol-relative media URLs, recognizes `video[src]`, extracts both HLS and MP4 from scripts/unpacked players, and follows nested HTTP(S) iframes with bounded depth=2, max 6 iframes/page and cycle prevention. Exact-head CI is pending, so no runtime completion credit is granted yet.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. Exact-head E2E after generic nested-iframe/media extractor strengthening; acceptance remains safe non-empty stream, with no waiver.
2. ArabSeed and FaselHD full E2E.
3. Anime4Up/WitAnime/3isk/EgyDead full E2E and evidence-based classification.
4. SyriaLive independent source/contract proof or remain Broken/degraded.
5. Tuktuk candidate remains quarantined pending identity/content/parser proof.
6. Backend security closure: SSRF, redirects, DNS rebinding, URL credentials/schemes, cookie isolation, limits, production CORS/PORT, streaming backpressure and Range/206.
7. Stremio manifest -> catalog -> meta -> stream live regression.
8. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependencies; TODO/FIXME/dead code; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from current completed evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Open: ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead full E2E; remaining security/Stremio/release gates.
- No `streams=0` waiver. `continue-on-error` only collects evidence; separate strict require steps keep CI red on provider failure.

## CI / tests / artifacts
- Run `35760956034` on `3c74669a418a239c62a3b6b8c74f72030a672a00`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact degraded contract green; six strict provider require gates red.
- Commit `9e2231c8a4ac28e839b3674ffccb389f66695fb5`: generic extractor nested iframe/relative media closure. Exact-head CI pending at state update.
- Releases/artifacts: none release-ready.

## Provider/domain health
- Working on completed runtime evidence: Akwam, Yacine TV.
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
- Six strict provider gates remain red on the latest completed exact-head run; none is promoted without full stream evidence.
- Generic extractor strengthening is intentionally uncredited until its exact-head CI/runtime evidence completes.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, Stremio runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Read exact-head CI after generic extractor strengthening. Promote any provider only if discovery/catalog -> metadata -> episodes when applicable -> safe non-empty stream passes. Otherwise use the new exact failure stage to fix the highest shared extractor/provider defect, then continue backend security and Stremio P0 gates.
