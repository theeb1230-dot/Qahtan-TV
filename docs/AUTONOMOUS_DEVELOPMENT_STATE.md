# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `077ef72b5423739a8ea7b0b4c9829018a9022d33`; exact-head CI run `35662901045` completed failure in `npm test`, so build and all provider runtime gates were skipped.
- Reinspection found the previous test-only isolation fix was insufficient: `new DomainRegistry()` still shared the module-level mutable `configs` object and `observations` map. Therefore a fresh registry could inherit `lastKnownGood`, health/cooldown and ranking state from another registry instance.
- Root architectural fix commit `fe45bad8d1fdc5c6a3e2b4375d70bc2020faddad`: immutable provider-domain baseline is now cloned per `DomainRegistry`; observations are instance-owned. The exported singleton remains the intentional production shared registry, while explicitly constructed registries are genuinely isolated.
- No runtime/degraded waiver was added. FaselHD remains `.co` primary and `.com` fail-closed fallback with no predeclared lastKnownGood; identity + parser proof remains mandatory.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. FaselHD E2E: exact-head CI must clear unit/build gates, then prove `.co` search/catalog -> metadata/details -> episodes when applicable -> non-empty safe HTTP(S) stream. No degraded waiver.
2. ArabSeed E2E.
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
- Closed from merged work: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Closed in code this cycle, pending exact-head CI: removed module-global mutable DomainRegistry state so independent registries cannot leak lastKnownGood/circuit/ranking observations across consumers.
- Open: exact-head green static/unit/build gates and FaselHD full E2E through stream; all later provider/security/release gates.

## CI / tests / artifacts
- Main `003f167613133054c4e08e257830822c012e0560`: green baseline.
- PR head `077ef72b...`: run `35662901045`; install/lint green, `npm test` red, build and Akwam/Yacine/WeCima/FaselHD runtime gates skipped. It supplies no new runtime evidence.
- Root cause is deeper than test object reuse: `DomainRegistry` instances themselves shared module-level configs/observations. Commit `fe45bad...` makes state instance-local while retaining the intentional exported singleton.
- Exact-head CI for `fe45bad...` was not available at final inspection; no completion credit is awarded until it runs.
- Releases/artifacts: none claimed release-ready.

## Provider/domain health
- Working on latest applicable completed runtime evidence: Akwam, Yacine TV.
- Partial/unverified current runtime: FaselHD, ArabSeed, Anime4Up, WitAnime, 3isk, EgyDead.
- Broken/degraded: WeCima (verified GitHub-runner Cloudflare challenge only), SyriaLive.
- Quarantined and excluded from ten-provider denominator: Tuktuk candidate.

## Weighted verified completion
| Category | Weight | Verified fraction | Earned |
|---|---:|---:|---:|
| Repo/build/CI baseline | 5 | 0.90 | 4.5 |
| Qahtan identity + provenance/licenses | 5 | 0.45 | 2.3 |
| DomainRegistry + identity verification + failover | 12 | 0.72 | 8.6 |
| Provider health/circuit/ranking/cache | 10 | 0.75 | 7.5 |
| Backend/network/proxy security | 13 | 0.75 | 9.8 |
| Discovery/catalog/search coverage | 8 | 0.62 | 5.0 |
| Metadata/details + seasons/episodes | 8 | 0.62 | 5.0 |
| Stream resolution/extractors | 10 | 0.55 | 5.5 |
| End-to-end provider runtime evidence | 15 | 0.20 | 3.0 |
| Stremio compatibility/regression | 4 | 0.60 | 2.4 |
| Observability/performance/error isolation | 3 | 0.60 | 1.8 |
| Release gate/artifact/runtime readiness | 7 | 0.40 | 2.8 |

**A) Overall Verified Product Completion: 58.0%.** No increase until the new exact head is CI-proven.

**B) Runtime-Verified Provider Completion: 2/10 = 20.0%.** Working: Akwam, Yacine TV. Partial/unverified: FaselHD, ArabSeed, Anime4Up, WitAnime, 3isk, EgyDead. Broken/degraded: WeCima, SyriaLive.

**C) Release Gate Completion: 3/7 = 42.9%.** Fixed denominator seven. Full security closure, no-open-P0/P1, sufficient advertised-provider E2E coverage, and exact release-SHA/artifact readiness remain unproven.

**D) Beta Readiness: 54.0%.** Current completed exact-head CI remains red before runtime gates.

## Risks / what does not work
- FaselHD `.co` still lacks exact-head E2E proof through stream because the newest completed run stopped in unit tests.
- `.com` remains known HTTP-403-blocked from the GitHub runner and is not considered Working.
- WeCima remains unusable from the current GitHub-hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Require exact-head CI for the instance-local DomainRegistry fix. If static/unit/build gates clear, inspect FaselHD `.co` runtime evidence and repair the first real identity/search/meta/episode/embed/stream defect without weakening E2E. Merge only when the final exact head is CI-green and mergeable; then move directly to ArabSeed E2E.
