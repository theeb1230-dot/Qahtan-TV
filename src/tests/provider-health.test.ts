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
    if (url === 'https://www.fasel-hd.co') throw new Error('upstream unavailable');
    return { value: 'stream-ok', identityVerified: true };
  });
  assert.equal(result.value, 'stream-ok');
  assert.equal(result.url, 'https://www.fasel-hd.com');
  assert.deepEqual(attempted, ['https://www.fasel-hd.co', 'https://www.fasel-hd.com']);
  assert.equal(domains.get('faselhd')?.lastKnownGood, 'https://www.fasel-hd.com');
  assert.equal(domains.observation('faselhd', 'https://www.fasel-hd.co')?.health, 'dead');
  assert.equal(domains.observation('faselhd', 'https://www.fasel-hd.com')?.health, 'healthy');

  // A fresh registry is intentional: the previous successful fallback must not
  // leak into this independent identity-failure scenario via module-level state.
  const identityDomains = new DomainRegistry();
  const identityHealth = new ProviderHealthManager(identityDomains, { now: () => now, failureCooldownMs: 30_000 });
  const before = identityDomains.get('faselhd')?.lastKnownGood;
  await assert.rejects(
    () => identityHealth.execute('faselhd', async () => {
      now += 10;
      return { value: 'wrong-site', identityVerified: false };
    }),
    /All domains failed/,
  );
  assert.equal(identityDomains.get('faselhd')?.lastKnownGood, before);

  // The user-supplied tuktuk candidate remains quarantined without identity proof.
  await assert.rejects(
    () => identityHealth.execute('tuktuk_candidate', async () => {
      now += 5;
      return { value: 'reachable', identityVerified: false };
    }),
    /identity verification failed/,
  );
  assert.equal(identityDomains.get('tuktuk_candidate')?.lastKnownGood, null);

  console.log('✓ provider health/circuit-breaker contract tests');
}
