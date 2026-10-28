import test from 'node:test';
import assert from 'node:assert/strict';
import { statusForStep, nextActionForStep, responsibleForStep, personaDescription, timelineForStep } from '../src/workflow-state.js';

test('maps authoritative workflow steps to request statuses', () => {
  assert.equal(statusForStep('Request Submitted'), 'Submitted');
  assert.equal(statusForStep('Approve Request?'), 'Under Review');
  assert.equal(statusForStep('Return & Restock'), 'Returned');
  assert.equal(statusForStep('Ready to Return?'), 'Deployed');
  assert.equal(statusForStep('Resubmit Request?'), 'Denied');
  assert.equal(statusForStep('Unknown'), null);
});

test('describes the next required approval or operational action', () => {
  assert.match(nextActionForStep('Approve Request?'), /approve or deny/i);
  assert.match(nextActionForStep('Logistics Review'), /Logistics/i);
  assert.equal(responsibleForStep('Approve Request?'), 'Approving Authority');
  assert.equal(responsibleForStep('Ready to Return?'), 'Operations');
  assert.match(personaDescription('Logistics'), /sources and commits/i);
  assert.match(personaDescription('Approving Authority'), /approves or denies/i);
  assert.equal(nextActionForStep('Unknown'), '');
});

test('builds a green timeline with exactly the current step pending', () => {
  const timeline = timelineForStep('Notify Ready to Deploy');
  assert.equal(timeline.filter(item => item.pending).length, 1);
  assert.equal(timeline.find(item => item.pending).step, 'Notify Ready to Deploy');
  assert.equal(timeline.every(item => item.pending || item.step), true);
});
