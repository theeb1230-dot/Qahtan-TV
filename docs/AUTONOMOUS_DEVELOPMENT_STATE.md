# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`.
- Inspected cycle-start PR head: `84b6c28b11e44336966b517fedc70b3380f1a69b`; CI run `35650984123` completed red only at FaselHD runtime. install/lint/26 tests/security contracts/build/Akwam/Yacine/WeCima degraded contract all passed.
- New deterministic FaselHD diagnostics proved the exact blocker: `https://www.fasel-hd.com/` returns HTTP 403 to the GitHub-hosted runner (`brand=false`, `parserContract=false`, 5777 bytes). The old `fasellhd.rest/main` fallback is a different contract and is correctly rejected.
- Fresh public evidence on 2026-09-22 identifies `https://www.fasel-hd.co/` as a live FaselHD catalog surface, while the `.com` origin is challenged/unstable for automation. The operational registry now uses `.co` as primary and keeps `.com` as a fail-closed fallback; no lastKnownGood is predeclared. The provider accepts only these explicit Fasel hosts and still requires brand + parser-contract proof before promotion.
- Commits this cycle update registry/provider/tests for domain drift; latest code head before this state update was `3fed476ef56b0e85bf3286d749dba359370336f1`. Exact-head CI evidence is still required before any runtime credit or merge.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission remains provenance only, not a third-party license grant.

## Blockers
### P0
1. FaselHD E2E: prove the new `.co` origin through search/catalog -> metadata/details -> episodes when applicable -> non-empty safe HTTP(S) stream. No degraded waiver.
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
- Closed this cycle: FaselHD failure is no longer ambiguous. Exact CI evidence proves `.com` is blocked with HTTP 403 from the runner, and the structurally unrelated `fasellhd.rest` endpoint is not treated as a valid fallback. Registry/provider contracts now track the independently live `.co` origin without pre-promoting it.
- Open: exact-head FaselHD full E2E through stream; all later provider/security/release gates.

## CI / tests / artifacts
- Main `003f167613133054c4e08e257830822c012e0560`: green baseline.
- PR head `84b6c28...`: run `35650984123` red only at FaselHD. Akwam runtime: 24 search, 24 catalog, metadata, 2 episodes, 3 safe streams. Yacine: 186 catalog, metadata, 1 safe stream. WeCima: expected 403 + `cf-mitigated=challenge` degraded contract.
- FaselHD on that run: `.com` landing HTTP 403; old `.rest` fallback rejected as non-canonical; zero search/catalog/meta/streams.
- New domain-drift code has not yet produced exact-head CI evidence, so no new runtime credit is awarded.
- Releases/artifacts: none claimed release-ready.

## Provider/domain health
- Working: Akwam, Yacine TV.
- Partial/unverified current runtime: FaselHD, ArabSeed, Anime4Up, WitAnime, 3isk, EgyDead.
- Broken/degraded: WeCima (verified GitHub-runner Cloudflare challenge only), SyriaLive.
- Quarantined and excluded from ten-provider denominator: Tuktuk candidate.

## Weighted verified completion
| Category | Weight | Verified fraction | Earned |
|---|---:|---:|---:|
| Repo/build/CI baseline | 5 | 0.95 | 4.8 |
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

**A) Overall Verified Product Completion: 58.3%.**

**B) Runtime-Verified Provider Completion: 2/10 = 20.0%.** Working: Akwam, Yacine TV. Partial/unverified: FaselHD, ArabSeed, Anime4Up, WitAnime, 3isk, EgyDead. Broken/degraded: WeCima, SyriaLive.

**C) Release Gate Completion: 3/7 = 42.9%.** Fixed denominator seven. Full security closure, no-open-P0/P1, sufficient advertised-provider E2E coverage, and exact release-SHA/artifact readiness remain unproven.

**D) Beta Readiness: 55.0%.** No increase is awarded for unverified domain-drift code.

## Risks / what does not work
- FaselHD `.com` is conclusively HTTP-403-blocked from the GitHub runner. `.co` is independently live but still needs exact-head E2E proof through stream.
- WeCima remains unusable from the current GitHub-hosted runtime because of its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Inspect exact-head CI for the `.co` domain-drift repair. If identity/search/meta advances, fix the first real episode/embed/stream defect without weakening E2E. Merge only when the final exact head is CI-green and mergeable; then move directly to ArabSeed E2E.
