# Autonomous Development State

## Current cycle
- Start/main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; work remains on this branch only. PR is open and currently mergeable after the latest branch update.
- Cycle-start PR head: `3e480c95226c7dd55dc83485088d89b4d3ae38c8`.
- Latest completed exact-head CI: run `35814298022` on merge ref `65833cc1f4785f19f743b5f6149bd1e60d42d372` for PR head `3e480c95226c7dd55dc83485088d89b4d3ae38c8` completed red because TypeScript lint/compile failed before runtime tests.
- Root cause fixed in this cycle: `src/domains/registry.ts` ArabSeed `ProviderDomainConfig` omitted required `lastCheckedAt`; this caused `TS2741` and skipped all runtime checks. Fix commit: `330ab2053be0314d4b45477283a9786f7b4a27c1`.
- The failed run still confirms the workflow reached install successfully, then stopped at `npm run lint`; tests/build/provider runtime steps were skipped. The later strict outcome checks failed as expected because their outcomes were `skipped`.
- Prior completed evidence remains unchanged until a new exact-head run proves otherwise: Akwam and Yacine Working; WeCima exact degraded contract; ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead strict gates open.

## Blockers ordered by release impact
### P0
1. Exact-head CI for `330ab2053be0314d4b45477283a9786f7b4a27c1`; runtime gates must execute again after the compile fix.
2. FaselHD, ArabSeed, Anime4Up, WitAnime, 3isk and EgyDead full E2E with evidence-based classification. A provider is not Working from HTTP 200 alone.
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
- Closed from completed evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation; compile regression on ArabSeed registry config fixed.
- Open: exact-head runtime rerun; ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead full E2E; remaining security/Stremio/release gates.
- No provider promotion or CI waiver is introduced by the compile fix.

## CI / tests / artifacts
- Run `35814298022` on merge ref `65833cc1f4785f19f743b5f6149bd1e60d42d372`: `npm install` green; `npm run lint` failed at `src/domains/registry.ts(18,3)` with `TS2741` because `lastCheckedAt` was missing from the ArabSeed config; tests/build/runtime were skipped; strict outcome checks then failed on `skipped` outcomes.
- Commit `330ab2053be0314d4b45477283a9786f7b4a27c1`: restores the required `lastCheckedAt: null` field on the ArabSeed domain config. Exact-head CI for this new head is not yet available, so it receives no new runtime credit.
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
- The latest exact-head run was blocked by a compile regression, so no fresh provider runtime evidence exists for the new branch head yet.
- Six strict provider gates remain open; none is promoted without full stream evidence.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; ArabSeed category paths are challenged; SyriaLive independence remains unproven.
- Security closure, Stremio runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Inspect exact-head CI for `330ab2053be0314d4b45477283a9786f7b4a27c1`. If lint/tests/build recover, use the first precise provider failure stage to fix the highest shared defect, then continue the strict runtime gates without waivers.
