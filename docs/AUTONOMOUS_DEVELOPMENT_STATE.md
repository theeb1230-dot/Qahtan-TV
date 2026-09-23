# Autonomous Development State

## Current cycle
- Start/main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; work remains on this branch only. PR is open and currently mergeable at inspection.
- Cycle-start PR head: `0f9995aba135383462acf77751a7543b153a5d86`.
- Latest completed exact-head CI: run `35810280278` on merge ref `67cccf9caf5fecdd821b0a2dd0c8b39fd930eaae` for PR head `0f9995aba135383462acf77751a7543b153a5d86` completed red. install/lint/tests/build, Akwam E2E, Yacine E2E, WeCima exact degraded contract and all provider evidence collection steps completed; strict require gates for ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk and EgyDead failed.
- Akwam/Yacine runtime evidence remains valid on the latest completed run. Akwam resolved 5 safe non-empty streams from a verified series path; Yacine resolved 1 safe non-empty stream from a verified TV path. No `streams=0` waiver exists.
- The latest run also proved the WeCima degraded contract precisely: status `403`, final host `wecima.cx`, `cfMitigated=challenge`, title `Just a moment...`, and no content links. ArabSeed was classified separately as home-reachable with category paths challenged (`403 + cf-mitigated=challenge`), not as a parser success.
- New code change on this cycle: commit `5891fcd7343c172febd2b5401e8f9fe3972ddb90` adds official ArabSeed entry points `https://arabseed.in` and `https://m.arabseed.wine` as quarantined candidates only. They are not primary, fallback, or last-known-good; promotion still requires identity, parser prerequisites and full runtime E2E.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers ordered by release impact
### P0
1. Exact-head CI for `5891fcd7343c172febd2b5401e8f9fe3972ddb90`, then ArabSeed official candidates must prove discovery/catalog -> metadata -> episodes when applicable -> safe non-empty stream. No degraded waiver for runtime success.
2. FaselHD, Anime4Up, WitAnime, 3isk and EgyDead full E2E with evidence-based classification. A provider is not Working from HTTP 200 alone.
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
- Closed from current completed evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Open: ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead full E2E; remaining security/Stremio/release gates.
- The new ArabSeed candidates are quarantined only; no provider promotion or CI waiver is introduced.

## CI / tests / artifacts
- Run `35810280278` on merge ref `67cccf9caf5fecdd821b0a2dd0c8b39fd930eaae`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact degraded contract green; ArabSeed/FaselHD/Anime4Up/WitAnime/3isk/EgyDead strict require gates red.
- Commit `5891fcd7343c172febd2b5401e8f9fe3972ddb90`: quarantined ArabSeed official candidates. Exact-head CI for this new head is not yet available at state update, so it receives no runtime completion credit.
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
- Six strict provider gates remain red on the latest completed exact-head run; none is promoted without full stream evidence.
- The new ArabSeed official candidates are uncredited until exact-head CI proves identity, parser prerequisites and the full runtime path.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; ArabSeed category paths are also challenged; SyriaLive independence remains unproven.
- Security closure, Stremio runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Inspect exact-head CI for `5891fcd7343c172febd2b5401e8f9fe3972ddb90`. If either ArabSeed official candidate reaches safe non-empty stream, promote only after full evidence and keep all other gates unchanged. Otherwise use the first precise failure stage, not broad provider labels, to fix the next highest shared defect, then continue security and Stremio P0 gates.
