import assert from 'node:assert/strict';
import { domainRegistry } from '../domains/registry.js';

export function runDomainRegistryTests(): void {
  const providers = domainRegistry.all();
  assert.equal(providers.length, 10);
  assert.equal(domainRegistry.get('akwam')?.primary, 'https://akwam.ss/one');
  assert.deepEqual(domainRegistry.get('faselhd')?.fallbacks, ['https://fasellhd.rest/main']);
  assert.deepEqual(domainRegistry.get('witanime')?.fallbacks, ['https://ristoanime.me']);
  assert.deepEqual(domainRegistry.get('3isk')?.fallbacks, ['https://e.3cktv.com']);
  assert.ok(domainRegistry.orderedUrls('faselhd').includes('https://www.fasel-hd.com'));
  assert.ok(domainRegistry.orderedUrls('faselhd').includes('https://fasellhd.rest/main'));
}
