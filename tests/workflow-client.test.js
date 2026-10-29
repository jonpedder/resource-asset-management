import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowClient } from '../src/workflow-client.js';

test('WorkflowClient binds fetch to globalThis before invoking it', async () => {
  const originalFetch = globalThis.fetch;
  let receiver;
  globalThis.fetch = async function () {
    receiver = this;
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true })
    };
  };
  try {
    const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
    const result = await client.call('jobs/search');
    assert.equal(receiver, globalThis);
    assert.deepEqual(result, { success: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('finishStep runs and finishes an automatic workflow step, then verifies movement', async () => {
  const calls = [];
  const client = new WorkflowClient({
    baseUrl: 'https://workflow.example.test/org/item',
    getToken: async () => 'token',
    getUsername: async () => 'operator',
    fetchImpl: async (url, init) => {
      calls.push([url, init]);
      const isJobRead = init.method === 'GET';
      const body = isJobRead ? { currentSteps: [{ stepId: 'next-step' }] } : { success: true, stepResponses: [{ status: 'Success' }] };
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => body };
    }
  });
  const result = await client.finishStep('job-1', 'email-step');
  assert.deepEqual(result.currentSteps, [{ stepId: 'next-step' }]);
  assert.match(calls[1][1].body, /"type":"Run"/);
  assert.match(calls[2][1].body, /"type":"Finish"/);
});
