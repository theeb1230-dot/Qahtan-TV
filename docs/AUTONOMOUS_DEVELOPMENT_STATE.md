# Autonomous Development State

## Current cycle
- Baseline main before feature branch: `781e6875bfcfd783cc807d02cdb9e3d46c798243`
- Active branch: `qahtan/domain-registry-foundation`
- Source baseline: 3rb exact SHA `d27b00f1894a63f86786ff04939d3c76b58f6677`
- Reuse permission: project owner explicitly allowed use, copying, modification and republication within Qahtan TV. Third-party notices remain independently applicable.

## Latest verified GitHub state
- main SHA: `781e6875bfcfd783cc807d02cdb9e3d46c798243`
- PR #1 active head before final state update: `6afa880f4d27e71d46c82c8acbfbc82143188b49`
- Initial CI failed before tests because setup-node npm caching expected package-lock.json while this source only carries bun.lock.
- CI workflow corrected: Node 24, current checkout/setup-node actions, no invalid npm cache assumption.
- Backend P0 hardening started: validated public HTTP(S) destinations, blocks private/reserved IPs before each redirect, manual redirect validation, production debug-fetch disabled, bounded request bodies/timeouts, environment PORT, production CORS allowlist, streaming proxy with backpressure and Range/206 header propagation, no full media buffering.

## Completed
- Imported the source tree into Qahtan-TV.
- Began Qahtan TV identity migration in package metadata, HTML and Stremio manifest.
- Added centralized provider domain registry with 2026-09-19 manually verified baseline domains supplied by the user.
- Added registry contract tests and CI gate for lint, tests and build.

## Provider/domain baseline
Akwam: akwam.ss/one
Yacine TV: yacinee-tv.net (API must remain separately verified)
Syria Live: mewsry.live
WeCima: wecima.cx
FaselHD: fasel-hd.com -> fasellhd.rest/main
ArabSeed: arabseed.wine/home/
Anime4Up: w1.anime4up.rest/home8/
WitAnime: witanime.you -> ristoanime.me
3isk: 3iskk.xyz -> e.3cktv.com
EgyDead: tv10.egydead.live/h3/

## Not yet proven
- Website-backed providers are wired to DomainRegistry; Yacine TV and SyriaLive intentionally retain separate API/parser endpoints until independently verified.
- No end-to-end provider is marked Working from this cycle.
- SyriaLive still requires parser separation from the Yacine implementation.
- Backend SSRF/proxy hardening is partially implemented; dedicated security tests and stronger DNS rebinding connection pinning/allow policy remain before P0 closure.
- Domain observations now track identity verification, latency, failures and cooldown with adaptive ordering. Active network health probes/identity fingerprints are still pending.

## Next
Implement safe active domain identity probes and isolate SyriaLive from the Yacine API implementation. Then add dedicated SSRF/DNS-rebinding/proxy security tests and provider end-to-end evidence.


## 2026-09-19 cycle evidence
- CI run #7 passed on exact prior PR head `c3876b06910bc26f75970aad39f781c6eb406bcf` (lint/tests/build).
- Added identity-gated last-known-good promotion: HTTP success without provider identity proof cannot replace the active domain.
- Added per-domain observations: last check/success, latency, consecutive failures, cooldown, reason and identity status.
- Added bounded exponential cooldown after repeated failures and adaptive URL ordering.
- Added contract tests for identity gating and circuit-breaker cooldown.
- No provider is claimed Working end-to-end yet; external functional verification remains a release gate.
