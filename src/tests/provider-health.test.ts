import assert from 'node:assert/strict';
import { DomainRegistry } from '../domains/registry.js';
import { ProviderHealthManager } from '../domains/health.js';

export async function runProviderHealthTests(): Promise<void> {
  let now = Date.parse('2026-09-19T14:00:00.000Z');
  const domains = new DomainRegistry();
  const health = new ProviderHealthManager(domains, { now: () => now, failureCooldownMs: 30_000 });

  const attempted: string[] = [];
  const result = await health.execute('faselhd', async (url) => {
    attempted.push(url);
    now += 25;
    if (url === 'https://www.fasel-hd.com') throw new Error('upstream unavailable');
    return { value: 'stream-ok', identityVerified: true };
  });
  assert.equal(result.value, 'stream-ok');
  assert.equal(result.url, 'https://fasellhd.rest/main');
  assert.deepEqual(attempted, ['https://www.fasel-hd.com', 'https://fasellhd.rest/main']);
  assert.equal(domains.get('faselhd')?.lastKnownGood, 'https://fasellhd.rest/main');
  assert.equal(domains.observation('faselhd', 'https://www.fasel-hd.com')?.health, 'dead');
  assert.equal(domains.observation('faselhd', 'https://fasellhd.rest/main')?.health, 'healthy');

  // A reachable impostor must never be promoted to lastKnownGood.
  const before = domains.get('faselhd')?.lastKnownGood;
  await assert.rejects(
    () => health.execute('faselhd', async () => {
      now += 10;
      return { value: 'wrong-site', identityVerified: false };
    }),
    /All domains failed/,
  );
  assert.equal(domains.get('faselhd')?.lastKnownGood, before);

  // The user-supplied tuktuk candidate remains quarantined without identity proof.
  await assert.rejects(
    () => health.execute('tuktuk_candidate', async () => {
      now += 5;
      return { value: 'reachable', identityVerified: false };
    }),
    /identity verification failed/,
  );
  assert.equal(domains.get('tuktuk_candidate')?.lastKnownGood, null);

  console.log('✓ provider health/circuit-breaker contract tests');
}
