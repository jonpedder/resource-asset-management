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
