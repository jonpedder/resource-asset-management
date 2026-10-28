import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLinks } from '../src/reconciliation.js';

test('reports blank, missing, and duplicate job links', () => {
  const requests = [
    { OBJECTID: 1, GlobalID: 'a', WFMJobId: '' },
    { OBJECTID: 2, GlobalID: 'b', WFMJobId: 'missing' },
    { OBJECTID: 3, GlobalID: 'c', WFMJobId: 'one' }
  ];
  const jobs = [
    { jobId: 'one', requestGlobalId: 'c' },
    { jobId: 'two', requestGlobalId: 'c' }
  ];
  assert.deepEqual(inspectLinks(requests, jobs).map(row => row.issue), ['blank-job-id', 'missing-job', 'duplicate-jobs']);
});
