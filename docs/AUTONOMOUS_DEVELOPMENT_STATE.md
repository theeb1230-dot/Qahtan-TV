# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `986539093286720ef6cced2443f903ebfb1a72ba`.
- Exact-head CI run `35740423166` completed red. Install, lint, tests, build, Akwam E2E, Yacine E2E and the exact WeCima degraded contract passed. Independent strict require gates prove ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead all failed runtime acceptance on this head.
- Live Anime4Up evidence confirms canonical `/anime/` detail pages expose episode lists and canonical `/episode/` pages expose multiple playback servers. The adapter still parsed only legacy episode containers and only anchor-based server selectors. Commit `ef463073d965224c5dae6607ca28ecd79b5e8236` fixes the shared parser gap by accepting canonical `/episode/` anchors with deduplication/episode-number extraction and generic first-party `data-ep-url`/`data-url` server elements, while retaining safe HTTP(S)-only stream output and existing extractor handling.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. Anime4Up exact-head E2E after canonical episode/server parser repair; acceptance remains search/catalog -> meta -> episodes -> safe non-empty stream.
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
- Run `35740423166` on `986539093286720ef6cced2443f903ebfb1a72ba`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact degraded contract green; ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead strict require gates red.
- Commit `ef463073d965224c5dae6607ca28ecd79b5e8236`: Anime4Up canonical episode/server parser repair. Exact-head CI pending at state update, therefore no runtime completion credit yet.
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
- Six strict provider gates remain red on completed exact-head run `35740423166`; none is promoted without full stream evidence.
- Anime4Up live structure showed a concrete parser mismatch now repaired, but the repair is not credited until exact-head E2E passes.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Read exact-head CI after the Anime4Up canonical episode/server parser repair. If Anime4Up reaches safe non-empty stream, promote it only from that evidence; otherwise diagnose the next exact stage. In parallel continue with the highest actionable defect among WitAnime/3isk/EgyDead, while external access blocks remain degraded rather than waived. Then continue security and Stremio P0 gates.
