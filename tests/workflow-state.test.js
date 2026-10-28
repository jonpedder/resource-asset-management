import test from 'node:test';
import assert from 'node:assert/strict';
import { statusForStep } from '../src/workflow-state.js';

test('maps authoritative workflow steps to request statuses', () => {
  assert.equal(statusForStep('Request Submitted'), 'Submitted');
  assert.equal(statusForStep('Approve Request?'), 'Under Review');
  assert.equal(statusForStep('Return & Restock'), 'Returned');
  assert.equal(statusForStep('Ready to Return?'), 'Deployed');
  assert.equal(statusForStep('Resubmit Request?'), 'Denied');
  assert.equal(statusForStep('Unknown'), null);
});
