import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinkedRequest } from '../src/request-saga.js';

const request = { OBJECTID: 7, GlobalID: '{A}' };

test('request saga orders verified writes and preserves exact job id', async () => {
  const calls = [];
  const result = await createLinkedRequest({
    attributes: { RequestTitle: 'Generator' }, correlationId: 'c1',
    createRequest: async a => (calls.push(['create', a.IntegrationState]), request),
    findJobsByRequestGlobalId: async id => (calls.push(['find', id]), []),
    createJob: async () => (calls.push(['job']), { jobId: 'Case-Sensitive_1' }),
    verifyJob: async (...a) => calls.push(['verifyJob', ...a]),
    linkRequest: async (...a) => calls.push(['link', ...a]),
    verifyRequestLink: async (...a) => calls.push(['verifyLink', ...a]),
    addAuditComment: async () => calls.push(['audit'])
  });
  assert.equal(result.jobId, 'Case-Sensitive_1');
  assert.deepEqual(calls.map(c => c[0]), ['create','find','job','verifyJob','link','verifyLink','audit']);
});

test('request saga reuses exactly one existing job', async () => {
  let created = false;
  const result = await createLinkedRequest({ attributes:{}, createRequest:async()=>request, findJobsByRequestGlobalId:async()=>[{jobId:'J1'}], createJob:async()=>{created=true;}, verifyJob:async()=>{}, linkRequest:async()=>{}, verifyRequestLink:async()=>{} });
  assert.equal(created, false); assert.equal(result.reusedJob, true);
});

test('duplicate jobs stop creation and require reconciliation', async () => {
  const marks=[];
  await assert.rejects(createLinkedRequest({ attributes:{}, createRequest:async()=>request, findJobsByRequestGlobalId:async()=>[{jobId:'1'},{jobId:'2'}], createJob:async()=>assert.fail(), markRequest:async(...a)=>marks.push(a) }), /Multiple/);
  assert.equal(marks[0][1], 'ReconcileRequired');
});