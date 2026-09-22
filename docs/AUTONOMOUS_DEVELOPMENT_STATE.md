# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `638f00a4a4c5600b92032188bb031fe0447ca988`.
- Exact-head CI run `35672492461` completed red only after reaching the new ArabSeed gate. Install, lint, 26/26 tests, network-security/bounded-response/provider-health/coalescing tests, build, Akwam E2E, Yacine E2E, and the exact WeCima degraded contract all passed. ArabSeed failed identity verification; FaselHD was skipped by fail-fast ordering.
- ArabSeed root cause: registry still used the stale path-shaped origin `https://www.arabseed.wine/home/`, while the current live contract exposes WordPress search and `/category/films/` + `/category/tv/` catalogs from the canonical origin. The provider also still parsed historical card selectors and `/find/`, `/movies`, `/series` paths.
- Fresh public evidence on 2026-09-22 confirms `www.arabseed.wine` serves ArabSeed-branded current content, `/category/tv/`, `/category/films/`, root-slug detail pages, episode links, and `/watch/` pages. The site itself identifies `arabseed.in` as its entry domain and `m.arabseed.wine` as its viewing domain; these are not automatically promoted because runtime identity/parser proof is still required.
- Commits `8c0b71ae95e7b7390e0a297f5221b3ff954825c5` and `ab9717423b8b2d0a07a50da7cd45e7d9e5bb6a7d` remove the stale `/home/` registry contract and update ArabSeed discovery/catalog/parser/meta/episode/watch handling for the current structure. No HTTP-200-only promotion and no degraded waiver were added.
- FaselHD remains externally blocked in hosted CI by HTTP 403 on both registered origins. No WAF/CAPTCHA bypass.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. ArabSeed exact-head E2E: prove search/catalog -> meta/details -> episodes when applicable -> non-empty safe HTTP(S) stream after the current-contract fix.
2. FaselHD E2E: hosted runner receives HTTP 403 on both registered origins; full strict acceptance remains open without waiver.
3. Anime4Up, WitAnime, 3isk, EgyDead E2E individually.
4. SyriaLive independent source/contract proof or remain Broken/degraded.
5. Tuktuk candidate quarantine investigation.
6. Stream/extractor hardening and complete outbound/debug/proxy security closure, preserving Range/206 and backpressure.
7. Stremio manifest -> catalog -> meta -> stream live regression.
8. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependencies; TODO/FIXME/dead code; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from current evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Closed this cycle: ArabSeed failure localized to stale provider/domain contract rather than general network failure; canonical origin and current WordPress catalog/search parser implemented.
- Open: exact-head proof of ArabSeed through stream; FaselHD full E2E; later provider runtime gates; security/Stremio/release gates.

## CI / tests / artifacts
- Main `003f167613133054c4e08e257830822c012e0560`: current base.
- PR head at cycle start `638f00a...`: run `35672492461`; static/unit/build/security gates green; Akwam Working E2E; Yacine Working E2E; WeCima exact Cloudflare degraded contract accepted; ArabSeed red at identity; FaselHD skipped.
- Akwam: search=24, catalog=24, meta=true, episodes=2, streams=3, safe HTTP(S)=true.
- Yacine: catalog=186, meta=true, streams=1, safe HTTP(S)=true.
- WeCima: 403, finalHost=`wecima.cx`, `cf-mitigated=challenge`; Broken/degraded, not Working.
- ArabSeed fix head includes `ab9717423b8b2d0a07a50da7cd45e7d9e5bb6a7d`; exact-head CI not yet available at state update, so it receives no runtime credit.
- Releases/artifacts: none release-ready.

## Provider/domain health
- Working on current completed runtime evidence: Akwam, Yacine TV.
- Partial/unverified current runtime: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead.
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

**A) Overall Verified Product Completion: 58.4%.** No credit added for the unproven ArabSeed fix.

**B) Runtime-Verified Provider Completion: 2/10 = 20.0%.** Working: Akwam, Yacine TV. Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead. Broken/degraded: WeCima, SyriaLive.

**C) Release Gate Completion: 3/7 = 42.9%.** Fixed denominator seven; security closure, no-open-P0/P1, advertised-provider E2E coverage, and exact release-SHA/artifact readiness remain unproven.

**D) Beta Readiness: 55.0%.** Build/security baseline is green and two providers are runtime-verified, but broad provider/runtime and release gates remain open.

## Risks / what does not work
- ArabSeed fix is implemented but not yet exact-head CI-proven; parser drift may expose a deeper meta/stream issue next.
- FaselHD cannot currently be proven from GitHub-hosted CI because both registered origins return HTTP 403 before discovery; not Working and not waived.
- WeCima remains unusable from the current hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Inspect exact-head CI after `ab971742...`. If ArabSeed reaches discovery/meta and fails later, fix the first real parser/watch/extractor defect without weakening the strict gate. If ArabSeed becomes Working, continue immediately to Anime4Up while FaselHD remains an explicit external-403 blocker. Keep all provider promotion identity-verified and fail-closed.
