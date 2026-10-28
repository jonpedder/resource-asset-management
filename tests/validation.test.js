import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLinkedRequest } from '../src/validation.js';

test('accepts a bidirectionally linked request and job', () => {
  assert.equal(assertLinkedRequest({ GlobalID: 'ABC', WFMJobId: 'job-1' }, { jobId: 'job-1', requestGlobalId: 'abc' }), true);
});

test('rejects blank and mismatched links immediately', () => {
  assert.throws(() => assertLinkedRequest({ GlobalID: 'ABC', WFMJobId: '' }, {}), /no linked/);
  assert.throws(() => assertLinkedRequest({ GlobalID: 'ABC', WFMJobId: 'job-1' }, { jobId: 'job-2', requestGlobalId: 'ABC' }), /do not match/);
});
