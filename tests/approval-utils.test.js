import test from 'node:test';
import assert from 'node:assert/strict';
import { actionsForStep, mailtoForRequest, requestorEmail } from '../src/approval-utils.js';

test('maps question and manual workflow steps to their live actions', () => {
  assert.deepEqual(actionsForStep('Approve Request?').map(a => a.response), [1, 0]);
  assert.equal(actionsForStep('Mobilize / Dispatch')[0].label, 'Resource mobilized / dispatched');
  assert.deepEqual(actionsForStep('Unknown step'), []);
});

test('builds a requestor mailto with asset, request details, and approver signature', () => {
  const attributes = { Requestor: 'requestor@example.gov', RequestTitle: 'Portable generator', RequestedKind: 'Generator', RequestedType: 'Type II', QuantityRequested: 2, Notes: 'Stage at EOC' };
  const href = mailtoForRequest(attributes, 'Alex Approver');
  assert.equal(requestorEmail(attributes), 'requestor@example.gov');
  assert.match(decodeURIComponent(href), /^mailto:requestor@example.gov\?subject=Resource request: Generator \/ Type II/);
  assert.match(decodeURIComponent(href), /Request: Portable generator/);
  assert.match(decodeURIComponent(href), /Regards,\nAlex Approver/);
});
