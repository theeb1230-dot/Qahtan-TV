# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `9ae45b8b3139e8bc8d8d4833143d4520c4b36c83`.
- Exact-head CI run `35694877612` completed red: install, lint, tests, build, Akwam E2E, Yacine E2E and exact WeCima degraded contract passed; ArabSeed failed; FaselHD was skipped by fail-fast ordering.
- Prior diagnostics proved ArabSeed home remains reachable/identity-valid while both `/category/films/` and `/category/tv/` are challenged from hosted CI. No challenge bypass is permitted or implemented.
- Root-cause resilience fix `ad416f5636b2d751e647dd3526551062cb2cd044`: ArabSeed search now isolates challenged search endpoints and verifies the first-party home contract before returning no hits; catalog tries canonical category first, then page-1 only falls back to parsing the verified first-party home catalog. This does not fetch a challenged path by alternate means, spoof access, or weaken stream acceptance. Page > 1 fails closed when category access is unavailable.
- FaselHD remains externally blocked in hosted CI by HTTP 403 on both registered origins. No bypass.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. ArabSeed exact-head E2E: prove verified-home catalog fallback reaches real meta/details and non-empty safe HTTP(S) stream; then separately prove series/episodes before full Working classification.
2. FaselHD E2E: hosted runner receives HTTP 403 on both registered origins; strict acceptance remains open without waiver.
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
- Open: exact-head proof of ArabSeed through stream; ArabSeed series/episodes applicable-capability proof; FaselHD full E2E; later provider runtime gates; security/Stremio/release gates.

## CI / tests / artifacts
- Main `003f167613133054c4e08e257830822c012e0560`: current base.
- PR head at cycle start `9ae45b8b...`: run `35694877612`; install/lint/tests/build green; Akwam Working E2E; Yacine Working E2E; WeCima exact Cloudflare degraded contract accepted; ArabSeed red; FaselHD skipped.
- Code commit `ad416f5636b2d751e647dd3526551062cb2cd044` adds verified-home catalog resilience for ArabSeed. Exact-head CI was not yet available at state update, so no runtime credit is granted.
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

**A) Overall Verified Product Completion: 58.4%.** No credit added for the unproven ArabSeed fallback.

**B) Runtime-Verified Provider Completion: 2/10 = 20.0%.** Working: Akwam, Yacine TV. Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead. Broken/degraded: WeCima, SyriaLive.

**C) Release Gate Completion: 3/7 = 42.9%.** Fixed denominator seven.

**D) Beta Readiness: 55.0%.** Two providers are runtime-verified; broad provider/runtime and release gates remain open.

## Risks / what does not work
- ArabSeed remains red on latest completed exact-head CI. The verified-home fallback is new and receives no runtime credit until exact-head CI proves it.
- FaselHD cannot currently be proven from GitHub-hosted CI because both registered origins return HTTP 403 before discovery; not Working and not waived.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Inspect exact-head CI after `ad416f5636b...`. If ArabSeed reaches meta and fails at watch/extractor, fix that first real defect without weakening the gate. If movie path becomes Working, add a separate current series/episode proof before declaring ArabSeed fully Working, then continue to Anime4Up while FaselHD remains an explicit external-403 blocker. Keep all provider promotion identity-verified and fail-closed.
