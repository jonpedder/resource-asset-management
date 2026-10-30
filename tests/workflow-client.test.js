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

test('completeStep never retries an advanced step when durable comment saving fails', async () => {
  const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
  let sends = 0;
  client.jobAction = async () => ({ success: true, stepResponses: [{ status: 'Success' }] });
  client.sendStepInformation = async () => { sends++; return [{ stepId: 'next-step' }]; };
  client.getJob = async () => ({ currentSteps: [{ stepId: 'next-step' }] });
  client.addComment = async () => { throw new Error('comment endpoint unavailable'); };
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const result = await client.completeStep('job-1', 'step-1', null, 'Decision note');
    assert.deepEqual(result, [{ stepId: 'next-step' }]);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(sends, 1);
});

test('completeStep verifies job movement before retrying a failed websocket acknowledgement', async () => {
  const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
  let sends = 0;
  let actions = 0;
  client.jobAction = async () => { actions++; return { success: true, stepResponses: [{ status: 'Success' }] }; };
  client.sendStepInformation = async () => { sends++; throw new Error('notification connection failed'); };
  client.getJob = async () => ({ currentSteps: [{ stepId: 'next-step' }] });
  client.addComment = async () => ({ success: true });
  const result = await client.completeStep('job-1', 'question-step', 1, 'Ready to return');
  assert.deepEqual(result, [{ stepId: 'next-step' }]);
  assert.equal(sends, 1);
  assert.equal(actions, 1);
});

test('completeStep waits for the job read endpoint to reflect the acknowledged step advance', async () => {
  const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
  let reads = 0;
  client.jobAction = async () => ({ success: true, stepResponses: [{ status: 'Success' }] });
  client.sendStepInformation = async () => [{ stepId: 'next-step' }];
  client.getJob = async () => ({ currentSteps: reads++ < 2 ? [{ stepId: 'mobilize-step' }] : [{ stepId: 'deploy-step' }] });
  const result = await client.completeStep('job-1', 'mobilize-step', null, '', { persistComment: false });
  assert.deepEqual(result, [{ stepId: 'deploy-step' }]);
  assert.equal(reads, 3);
});

test('completeStep waits when Workflow Manager briefly returns the same step name under a new execution id', async () => {
  const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
  let reads=0;
  client.jobAction=async()=>({success:true,stepResponses:[{status:'Success'}]});
  client.sendStepInformation=async()=>[{stepId:'next-execution',stepName:'Deploy / In Use'}];
  client.getJob=async()=>({currentSteps:reads++===0?[{stepId:'next-execution',stepName:'Deploy / In Use'}]:[{stepId:'ready-return',stepName:'Ready to Return?'}]});
  const result=await client.completeStep('job-1','deploy-execution','manual', '', {persistComment:false,expectedStepName:'Deploy / In Use'});
  assert.deepEqual(result,[{stepId:'ready-return',stepName:'Ready to Return?'}]);
  assert.equal(reads,2);
});

test('finishStep treats an already-finished refusal as success after verifying the step advanced', async () => {
  const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
  client.jobAction = async (_jobId,type) => type==='Finish'
    ? { success:true,stepResponses:[{status:'Failed',statusDescription:'The step is already finished'}] }
    : { success:true,stepResponses:[{status:'Success'}] };
  client.getJob = async () => ({currentSteps:[{stepId:'deploy-step'}]});
  const result=await client.finishStep('job-1','mobilize-step');
  assert.equal(result.alreadyAdvanced,true);
  assert.deepEqual(result.currentSteps,[{stepId:'deploy-step'}]);
});

test('finishStep preserves a refusal when the attempted step is still current', async () => {
  const client = new WorkflowClient({ baseUrl: 'https://workflow.example.test/org/item', getToken: async () => 'token' });
  client.jobAction = async (_jobId,type) => type==='Finish'
    ? { success:true,stepResponses:[{status:'Failed',statusDescription:'Not allowed'}] }
    : { success:true,stepResponses:[{status:'Success'}] };
  client.getJob = async () => ({currentSteps:[{stepId:'email-step'}]});
  await assert.rejects(()=>client.finishStep('job-1','email-step'),/Finish was refused: Not allowed/);
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
