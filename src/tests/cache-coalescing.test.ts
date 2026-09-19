import assert from 'node:assert/strict';
import { InFlightCoalescer } from '../utils/cache.js';

export async function runCacheCoalescingTests(): Promise<void> {
  const inflight = new InFlightCoalescer();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  const factory = async () => {
    calls += 1;
    await gate;
    return { ok: true };
  };

  const first = inflight.run('same-request', factory);
  const second = inflight.run('same-request', factory);
  assert.equal(calls, 0, 'factory starts asynchronously');
  await Promise.resolve();
  assert.equal(calls, 1, 'concurrent duplicate must share one upstream call');
  assert.equal(inflight.size(), 1);
  release();
  assert.strictEqual(await first, await second);
  await Promise.resolve();
  assert.equal(inflight.size(), 0, 'settled request must leave no stale in-flight entry');

  let failureCalls = 0;
  await assert.rejects(() => inflight.run('failure', async () => {
    failureCalls += 1;
    throw new Error('upstream failed');
  }), /upstream failed/);
  await assert.rejects(() => inflight.run('failure', async () => {
    failureCalls += 1;
    throw new Error('upstream failed again');
  }), /upstream failed again/);
  assert.equal(failureCalls, 2, 'failed requests must not be cached as in-flight successes');

  console.log('✓ in-flight request coalescing contract tests');
}
