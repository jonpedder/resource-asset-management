import test from 'node:test';
import assert from 'node:assert/strict';
import { auditEntryHeading, auditEntryIdentity, normalizeAuditEntries } from '../src/audit-history.js';

test('formats audit phase and progress without the internal rr prefix', () => {
  const history = [{ date: '2026-10-29T22:35:15Z', username: 'JonPSO', action: 'Started', stepId: 'rr-email-ready' }];
  const comments = [{ date: '2026-10-29T22:35:14Z', username: 'JonPSO', comment: 'Notification approved.' }];
  const entries = normalizeAuditEntries(history, comments);
  assert.equal(entries.length, 1);
  assert.equal(auditEntryHeading(entries[0]), 'Audit email-ready - Started');
  assert.equal(entries[0].comment, 'Notification approved.');
});

test('uses a safe identity fallback when identity fields and date are missing', () => {
  const entries = normalizeAuditEntries([{ action: 'Started', stepId: 'rr-review' }]);
  assert.equal(entries.length, 1);
  assert.equal(auditEntryIdentity(entries[0], () => 'unexpected date'), 'Identity: Workflow Manager');
});

test('keeps comments one-to-one with audit entries', () => {
  const history = [
    { date: '2026-10-28T02:20:00Z', username: 'Pedder', action: 'Completed', stepId: 'one', stepName: 'First action' },
    { date: '2026-10-28T02:21:00Z', username: 'Pedder', action: 'Completed', stepId: 'two', stepName: 'Second action' }
  ];
  const comments = [
    { date: '2026-10-28T02:20:01Z', username: 'Pedder', comment: 'First note' },
    { date: '2026-10-28T02:21:01Z', username: 'Pedder', comment: 'Second note' }
  ];
  const entries = normalizeAuditEntries(history, comments);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => entry.comment).sort(), ['First note', 'Second note']);
  assert.ok(entries.every(entry => !entry.comment.includes('\n')));
});
