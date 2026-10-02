import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registryRequest, RegistryUnavailable, retryDelay } from '../lib/registry.ts';
test('recovers after transient failures within three attempts', async () => {
  let calls = 0; const delays = [];
  const result = await registryRequest('https://example.test', {
    fetcher: async () => ++calls < 3 ? new Response('', {status:503}) : Response.json({ok:true}),
    wait: async ms => { delays.push(ms); },
  });
  assert.deepEqual(result, {status:200,data:{ok:true}});
  assert.deepEqual(delays,[300,600]);
});
test('honors a short rate-limit delay and stops on a long cooldown', async () => {
  let calls = 0; const delays = [];
  await registryRequest('https://example.test', {
    fetcher: async () => ++calls === 1 ? new Response('', {status:429,headers:{'Retry-After':'2'}}) : Response.json({}),
    wait: async ms => { delays.push(ms); },
  });
  assert.deepEqual(delays,[2000]);
  calls = 0;
  await assert.rejects(registryRequest('https://example.test', {
    fetcher: async () => { calls++; return new Response('', {status:429,headers:{'Retry-After':'60'}}); },
    wait: async () => { assert.fail('must not wait or retry early'); },
  }), error => error instanceof RegistryUnavailable && error.retryAfter === '60');
  assert.equal(calls,1);
});
test('does not retry a missing record or malformed JSON', async () => {
  let calls = 0;
  assert.equal((await registryRequest('https://example.test', {fetcher:async()=>{calls++;return new Response('',{status:404});}})).status,404);
  assert.equal(calls,1);
  await assert.rejects(registryRequest('https://example.test', {fetcher:async()=>{calls++;return new Response('{bad');}}));
  assert.equal(calls,2);
});
test('network errors stop after three attempts; cancellation prevents fetch', async () => {
  let calls = 0;
  await assert.rejects(registryRequest('https://example.test', {fetcher:async()=>{calls++;throw Error('offline');},wait:async()=>{}}));
  assert.equal(calls,3);
  await assert.rejects(registryRequest('https://example.test', {signal:AbortSignal.abort(),fetcher:async()=>{assert.fail('cancelled');}}));
});
test('parses Retry-After seconds and HTTP dates', () => {
  assert.equal(retryDelay('3'),3000);
  assert.equal(retryDelay('Wed, 01 Jan 2025 00:00:03 GMT',Date.parse('2025-01-01T00:00:00Z')),3000);
  assert.equal(retryDelay('not a date'),null);
});
