import assert from 'node:assert/strict';
import { domainRegistry } from '../domains/registry.js';
import { registry } from '../providers/index.js';

export function runDomainRegistryTests(): void {
  const providers = domainRegistry.all();
  assert.equal(providers.length, 11);
  assert.equal(domainRegistry.get('akwam')?.primary, 'https://akwam.ss/one');
  assert.equal(domainRegistry.get('tuktuk_candidate')?.primary, 'https://zx33.tuktuk-sa.online');
  assert.equal(domainRegistry.get('tuktuk_candidate')?.lastKnownGood, null);
  assert.equal(domainRegistry.get('tuktuk_candidate')?.health, 'unknown');
  assert.deepEqual(domainRegistry.get('faselhd')?.fallbacks, ['https://fasellhd.rest/main']);
  assert.deepEqual(domainRegistry.get('witanime')?.fallbacks, ['https://ristoanime.me']);
  assert.deepEqual(domainRegistry.get('3isk')?.fallbacks, ['https://e.3cktv.com']);
  assert.ok(domainRegistry.orderedUrls('faselhd').includes('https://www.fasel-hd.com'));
  assert.ok(domainRegistry.orderedUrls('faselhd').includes('https://fasellhd.rest/main'));
  assert.equal(registry.getProvider('akwam')?.mainUrl, 'https://akwam.ss/one');
  assert.equal(registry.getProvider('wecima')?.mainUrl, 'https://wecima.cx');
  assert.equal(registry.getProvider('faselhd')?.mainUrl, 'https://www.fasel-hd.com');
  assert.equal(registry.getProvider('3isk')?.mainUrl, 'https://3iskk.xyz');
  // Yacine public identity and encrypted operational API are deliberately separate contracts.
  assert.equal(registry.getProvider('yacinetv')?.mainUrl, 'https://yacinee-tv.net');
  assert.equal(domainRegistry.get('yacinetv')?.primary, 'https://def.ycnapi.com/api');
  assert.deepEqual(domainRegistry.get('yacinetv')?.fallbacks, ['https://deft.yacinelive.com/api']);
  assert.equal(domainRegistry.get('yacinetv')?.lastKnownGood, null);
  assert.equal(registry.getProvider('syrialive')?.mainUrl, 'https://www.mewsry.live');
  assert.notEqual(registry.getProvider('syrialive')?.mainUrl, registry.getProvider('yacinetv')?.mainUrl);
  // HTTP reachability alone must never promote an unverified domain.
  domainRegistry.mark('faselhd', 'https://fasellhd.rest/main', 'healthy', '2026-09-19T00:00:00.000Z', { identityVerified:false, latencyMs:20 });
  assert.equal(domainRegistry.get('faselhd')?.lastKnownGood, 'https://www.fasel-hd.com');

  // Identity-verified success is eligible to become last-known-good.
  domainRegistry.mark('faselhd', 'https://fasellhd.rest/main', 'healthy', '2026-09-19T00:01:00.000Z', { identityVerified:true, latencyMs:20 });
  assert.equal(domainRegistry.get('faselhd')?.lastKnownGood, 'https://fasellhd.rest/main');

  // Repeated failures trigger cooldown and push a broken domain behind a healthy candidate.
  domainRegistry.mark('faselhd', 'https://fasellhd.rest/main', 'dead', '2026-09-19T00:02:00.000Z', { identityVerified:false });
  domainRegistry.mark('faselhd', 'https://fasellhd.rest/main', 'dead', '2026-09-19T00:02:01.000Z', { identityVerified:false });
  domainRegistry.mark('faselhd', 'https://fasellhd.rest/main', 'dead', '2026-09-19T00:02:02.000Z', { identityVerified:false });
  assert.ok(domainRegistry.observation('faselhd', 'https://fasellhd.rest/main')?.cooldownUntil);
  assert.notEqual(domainRegistry.orderedUrls('faselhd', Date.parse('2026-09-19T00:02:03.000Z'))[0], 'https://fasellhd.rest/main');
}
