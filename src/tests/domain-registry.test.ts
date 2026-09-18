import assert from 'node:assert/strict';
import { domainRegistry } from '../domains/registry.js';
import { registry } from '../providers/index.js';

export function runDomainRegistryTests(): void {
  const providers = domainRegistry.all();
  assert.equal(providers.length, 10);
  assert.equal(domainRegistry.get('akwam')?.primary, 'https://akwam.ss/one');
  assert.deepEqual(domainRegistry.get('faselhd')?.fallbacks, ['https://fasellhd.rest/main']);
  assert.deepEqual(domainRegistry.get('witanime')?.fallbacks, ['https://ristoanime.me']);
  assert.deepEqual(domainRegistry.get('3isk')?.fallbacks, ['https://e.3cktv.com']);
  assert.ok(domainRegistry.orderedUrls('faselhd').includes('https://www.fasel-hd.com'));
  assert.ok(domainRegistry.orderedUrls('faselhd').includes('https://fasellhd.rest/main'));
  assert.equal(registry.getProvider('akwam')?.mainUrl, 'https://akwam.ss/one');
  assert.equal(registry.getProvider('wecima')?.mainUrl, 'https://wecima.cx');
  assert.equal(registry.getProvider('faselhd')?.mainUrl, 'https://www.fasel-hd.com');
  assert.equal(registry.getProvider('3isk')?.mainUrl, 'https://3iskk.xyz');
  assert.notEqual(registry.getProvider('yacinetv')?.mainUrl, 'https://yacinee-tv.net');
  assert.notEqual(registry.getProvider('syrialive')?.mainUrl, 'https://www.mewsry.live');
}
