# Autonomous Development State

## Current cycle
- Start/end main SHA: `003f167613133054c4e08e257830822c012e0560`; default branch `main`.
- Single active PR: #26 `qahtan/p0-runtime-faselhd-evidence`; mergeable at inspection.
- Cycle-start PR head: `5d7b528b0b1ecace77978f5a50536817cf5067f9`.
- Exact-head CI run `35711212046` completed red. Install, lint, tests, build, Akwam E2E, Yacine E2E and the exact WeCima degraded contract all passed. Both ArabSeed and FaselHD runtime collection steps executed; the old combined aggregate strict gate failed.
- The combined aggregate proved at least one of ArabSeed/FaselHD failed but GitHub step metadata could not identify which provider because both collection steps use `continue-on-error`. This cycle replaces that opaque aggregate with two independent strict require steps, both `if: always()`, so GitHub step conclusions identify ArabSeed and FaselHD separately while either failure still keeps the job red.
- Workflow commit: `7956e49f34e8bbdc72c32ea66a9d081ec17aecab`.
- No provider is promoted from the workflow change itself; exact-head runtime evidence remains required.
- Source baseline: 3rb SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`; reuse permission is provenance only, not a third-party license grant.

## Blockers
### P0
1. ArabSeed E2E: prove search/catalog -> meta/details -> safe non-empty stream, then series/episodes capability before full Working classification.
2. FaselHD E2E: prove strict runtime independently; prior hosted evidence showed external HTTP 403 on registered origins.
3. Anime4Up, WitAnime, 3isk, EgyDead E2E individually.
4. SyriaLive independent source/contract proof or remain Broken/degraded.
5. Tuktuk candidate quarantine investigation.
6. Stream/extractor hardening and outbound/debug/proxy security closure, including SSRF/redirect/DNS-rebinding/limits and Range/206 backpressure.
7. Stremio manifest -> catalog -> meta -> stream live regression.
8. Beta then v1.0 release gates.

### P1
Qahtan/3rb provenance and third-party LICENSE/NOTICE audit; dependencies; TODO/FIXME/dead code; structured observability/metrics; caching/performance/error isolation.

### P2
UX/polish only after P0/P1.

## Acceptance criteria
- Closed from current evidence: Akwam real safe stream path; Yacine runtime regression; exact WeCima Cloudflare-only degraded contract; tested DomainRegistry/provider-health foundation.
- Open: ArabSeed full stream proof and series/episodes proof; FaselHD full E2E; later provider runtime gates; security/Stremio/release gates.
- CI must expose independent provider outcomes without weakening strict acceptance. Either ArabSeed or FaselHD failure keeps the job red.

## CI / tests / artifacts
- Run `35711212046` on `5d7b528b...`: install/lint/tests/build green; Akwam Working E2E green; Yacine Working E2E green; WeCima exact Cloudflare degraded contract accepted; ArabSeed and FaselHD collection steps both executed; combined strict gate red.
- `7956e49f34e8bbdc72c32ea66a9d081ec17aecab`: split the opaque combined aggregate into independent `P0 require ArabSeed runtime success` and `P0 require FaselHD runtime success` steps, both always evaluated.
- Exact-head CI for `7956e49f...` was not yet available at this state update; no runtime credit is granted from the workflow change.
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

**A) Overall Verified Product Completion: 58.4%.** No completion credit added for CI observability alone.

**B) Runtime-Verified Provider Completion: 2/10 = 20.0%.** Working: Akwam, Yacine TV. Partial/unverified: ArabSeed, FaselHD, Anime4Up, WitAnime, 3isk, EgyDead. Broken/degraded: WeCima, SyriaLive.

**C) Release Gate Completion: 3/7 = 42.9%.** Fixed denominator seven.

**D) Beta Readiness: 55.0%.** Broad provider/runtime and release gates remain open.

## Risks / what does not work
- At least one of ArabSeed/FaselHD failed strict runtime on run `35711212046`; the old aggregate did not expose which one through step conclusions. The workflow now fixes that evidence ambiguity without a waiver.
- ArabSeed is not Working until full stream and series/episodes capability are proven.
- FaselHD has prior external-403 evidence and remains unverified until a strict E2E succeeds.
- WeCima remains unusable from hosted runtime due its specifically verified Cloudflare challenge; SyriaLive independence remains unproven.
- Security closure, broad Stremio/extractor runtime proof, licensing/dependency audit and release artifacts remain open.

## Next target
Stay on PR #26. Read exact-head CI after `7956e49f...`; the two independent require steps must reveal exactly whether ArabSeed, FaselHD, or both fail while keeping CI strict. Fix the first actionable code defect shown by that evidence. If failures are external access blocks rather than code defects, keep those providers unverified and advance to the next independent provider E2E proof without promotion or waiver.
