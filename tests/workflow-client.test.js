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

test('updateExtendedProperties writes string values and verifies the saved properties', async () => {
  const calls=[];
  const client=new WorkflowClient({baseUrl:'https://workflow.example.test/org/item',getToken:async()=> 'token'});
  client.call=async(path,options)=>{calls.push([path,options]);return path.endsWith('?extProps=true')?{extendedProperties:[{tableName:'resource_request',properties:[{propertyName:'denial_reason',value:'Insufficient justification'},{propertyName:'request_status',value:'Denied'}]}]}:{success:true};};
  await client.updateExtendedProperties('job-1',{'resource_request.denial_reason':'Insufficient justification','resource_request.request_status':'Denied'});
  assert.equal(calls[0][0],'jobs/job-1/update');
  assert.deepEqual(calls[0][1].body.extendedProperties,[{identifier:'resource_request.denial_reason',value:'Insufficient justification'},{identifier:'resource_request.request_status',value:'Denied'}]);
});

test('completeStep treats a lost notification as success when the workflow already advanced', async () => {
  const client=new WorkflowClient({baseUrl:'https://workflow.example.test/org/item',getToken:async()=> 'token'});
  let sends=0,comments=0;
  client.jobAction=async()=>({success:true,stepResponses:[{status:'Success'}]});
  client.sendStepInformation=async()=>{sends++;throw new Error('Notification connection failed');};
  client.getJob=async()=>({currentSteps:[{stepId:'next-step'}]});
  client.addComment=async()=>{comments++;};
  const steps=await client.completeStep('job-1','demobilize-step',null,'Good to go');
  assert.deepEqual(steps,[{stepId:'next-step'}]);
  assert.equal(sends,1);
  assert.equal(comments,0);
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
