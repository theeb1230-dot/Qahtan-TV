# Autonomous Development State

## Current cycle
- Baseline main before feature branch: `781e6875bfcfd783cc807d02cdb9e3d46c798243`
- Active branch / PR: `qahtan/domain-registry-foundation` / #1
- Source baseline: 3rb exact SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`
- Reuse permission: project owner explicitly allowed use, copying, modification and republication within Qahtan TV. Third-party notices remain independently applicable.

## Latest verified GitHub state
- main SHA: `781e6875bfcfd783cc807d02cdb9e3d46c798243`
- CI run #10 succeeded on exact PR head `9ca8911637fbbac5a60ce84a2fa950e462546027` before the SyriaLive isolation commit.
- Current code head before this state update: `9b8080ea92c99d98e1aface6ef459606f5fbfdcd`; its CI must pass before merge.
- No release exists yet.

## Completed
- Imported the authorized source tree and began Qahtan TV identity migration.
- Added centralized 10-provider DomainRegistry from the user-verified 2026-09-19 baseline.
- Website-backed providers consume the registry baseline; Yacine website identity remains separate from its API endpoint.
- Added identity-gated last-known-good promotion, per-domain latency/failure/last-success observations, adaptive ordering and bounded circuit-breaker cooldown.
- Hardened the backend baseline: public HTTP(S) destination validation, private/reserved destination blocking, redirect validation, production debug-fetch disabled, bounded request bodies/timeouts, environment PORT, production CORS allowlist, streaming proxy/backpressure and Range header propagation.
- Removed the inherited false SyriaLive/Yacine duplication. SyriaLive no longer calls `def.ycnapi.com`, imports `decryptYacine`, or emits Yacine-derived events/streams. It now fails closed until an independent SyriaLive contract is verified.

## Provider/domain baseline
Akwam: akwam.ss/one
Yacine TV website: yacinee-tv.net (API separately verified before changes)
Syria Live: mewsry.live
WeCima: wecima.cx
FaselHD: fasel-hd.com -> fasellhd.rest/main
ArabSeed: arabseed.wine/home/
Anime4Up: w1.anime4up.rest/home8/
WitAnime: witanime.you -> ristoanime.me
3isk: 3iskk.xyz -> e.3cktv.com
EgyDead: tv10.egydead.live/h3/

## Provider evidence
- SyriaLive: Broken/degraded by design pending independent parser verification. The previous implementation was invalid because it was Yacine under a second name; that coupling is removed rather than reported as success.
- Other providers: no provider is yet claimed Working end-to-end in this development state. Parser existence or HTTP reachability is not sufficient evidence.

## Remaining release blockers
- Current-head CI after SyriaLive isolation.
- Independent SyriaLive website contract/parser verification.
- Active domain identity probes/identity fingerprints.
- Dedicated SSRF/DNS-rebinding/proxy security tests; stronger rebinding-resistant connection policy remains P0.
- Cookie jar domain/path/expiry isolation, bounded retries/backoff/concurrency/rate/response-size controls.
- Provider health integration and real end-to-end evidence through stream resolution for each usable provider.
- Complete identity/license/TODO/dead-code audit and release gate review.

## Next
Require green CI on the exact current PR head, then continue P0 backend security and active domain health verification. Keep SyriaLive visibly degraded until its own independently verified contract exists; never restore the Yacine alias as a shortcut.

## 2026-09-19 tuktuk candidate cycle
- Exact failing PR head inspected: `27d7bda6f852976ce9d3178ccbfbae02df1355bb`; CI run #12 failed only in domain-registry contract tests after the intentional SyriaLive separation. Lint passed.
- Fixed stale SyriaLive assertion: SyriaLive is expected to use `https://www.mewsry.live` and must differ from Yacine's API endpoint.
- Added `https://zx33.tuktuk-sa.online` as quarantined `tuktuk_candidate` with `lastKnownGood=null`, `health=unknown`, and no identity hints. It is not registered as a content Provider and cannot be selected as Working.
- Public lookup/fetch from the available environment did not establish the candidate's identity or functional contract, so promotion is deliberately blocked.
- Added tests enforcing the candidate remains fail-closed until identity verification.
