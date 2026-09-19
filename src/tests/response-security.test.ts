import assert from 'node:assert/strict';
import { readBoundedTextPreview } from '../security/response.js';

export async function runResponseSecurityTests() {
  const short = await readBoundedTextPreview(new Response('qahtan'), 64);
  assert.equal(short.preview, 'qahtan');
  assert.equal(short.truncated, false);

  const long = await readBoundedTextPreview(new Response('0123456789'), 5);
  assert.equal(long.preview, '01234');
  assert.equal(long.truncated, true);

  await assert.rejects(() => readBoundedTextPreview(new Response('x'), 0), /positive integer/);
  console.log('✓ bounded response preview security tests');
}
