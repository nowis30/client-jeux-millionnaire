import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestVerifiedReward } from '../lib/reward-verification-core.ts';

function fixture() {
  const state = { supported: true, shown: true, verified: true, consumed: false, expired: false, requests: [], ads: [], waits: 0, storage: new Map() };
  const services = {
    supported: async () => state.supported,
    request: async (path, init) => { state.requests.push({path, init}); return init?.method === 'POST' ? { id: 'receipt', userId: 'user' } : { verified: state.verified, consumed: state.consumed, expired: state.expired }; },
    show: async options => { state.ads.push(options); return state.shown; },
    readPending: key => state.storage.get(key) ?? null,
    writePending: (key, value) => value ? state.storage.set(key, value) : state.storage.delete(key),
    wait: async () => { state.waits++; },
  };
  return {state, services};
}
test('old Android plugin is rejected before an ad or intent is created', async () => {
  const {state,services}=fixture(); state.supported=false;
  await assert.rejects(requestVerifiedReward(services,'game','bonus'), /Mettez/);
  assert.equal(state.requests.length,0); assert.equal(state.ads.length,0);
});
test('bind native ad to the server intent and user before returning the verified receipt', async () => {
  const {state,services}=fixture();
  assert.equal(await requestVerifiedReward(services,'game','quiz-reveal',{sessionId:'session',questionId:'question'}),'receipt');
  assert.deepEqual(state.ads[0],{ignoreCooldown:true,verification:{intentId:'receipt',userId:'user'}});
  assert.deepEqual(JSON.parse(state.requests[0].init.body),{kind:'quiz-reveal',sessionId:'session',questionId:'question'});
});
test('cancelled ad grants no receipt', async () => {
  const {state,services}=fixture();state.shown=false;
  assert.equal(await requestVerifiedReward(services,'game','bonus'),null);
  assert.equal(state.storage.size,0);assert.equal(state.requests.length,1);
});
test('unverified ad times out and is recoverable without showing another ad', async () => {
  const {state,services}=fixture();state.verified=false;
  await assert.rejects(requestVerifiedReward(services,'game','bonus'),/confirmation/);
  assert.equal(state.waits,30);assert.equal(state.ads.length,1);assert.equal(state.storage.size,1);
  state.verified=true;
  assert.equal(await requestVerifiedReward(services,'game','bonus'),'receipt');
  assert.equal(state.ads.length,1);
});
test('expired or consumed receipt is never returned as a reward', async () => {
  for (const key of ['expired','consumed']) {
    const {state,services}=fixture();state[key]=true;
    await assert.rejects(requestVerifiedReward(services,'game','bonus'),/expiré/);
    assert.equal(state.storage.size,0);
  }
});
