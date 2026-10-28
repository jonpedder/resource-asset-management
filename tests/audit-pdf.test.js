import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditPdf } from '../src/audit-pdf.js';

test('builds a downloadable PDF containing request and audit text', async () => {
  const blob = buildAuditPdf(
    { RequestTitle: 'Generator Request', WFMJobId: 'JOB-42', GlobalID: '{ABC}', IncidentName: 'Storm Response' },
    [{ date: '2026-10-28T17:00:00Z', user: 'operator', persona: 'Operations', title: 'Asset deployed', detail: 'Moved to staging', comment: 'Approved' }],
    new Date('2026-10-28T18:00:00Z')
  );
  assert.equal(blob.type, 'application/pdf');
  const pdf = await blob.text();
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /Generator Request/);
  assert.match(pdf, /Asset deployed/);
  assert.match(pdf, /%%EOF$/);
});

test('paginates long audit histories', async () => {
  const entries = Array.from({ length: 90 }, (_, index) => ({ user: 'operator', title: `Workflow event ${index + 1}`, detail: 'Completed workflow processing step.' }));
  const pdf = await buildAuditPdf({ RequestTitle: 'Long Audit' }, entries).text();
  const pageCount = Number(pdf.match(/\/Count (\d+)/)?.[1]);
  assert.ok(pageCount > 1);
});

test('applies app branding and embeds an agency logo', async () => {
  const branding = {
    appName: 'County Emergency Management', subtitle: 'Operational Resource Coordination',
    colors: { navy: '#112233', accent: '#F0A000' },
    logo: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 }
  };
  const pdf = await buildAuditPdf({ RequestTitle: 'Branded Request' }, [{ title: 'Created' }], new Date('2026-10-28T18:00:00Z'), branding).text();
  assert.match(pdf, /County Emergency Management/);
  assert.match(pdf, /Operational Resource Coordination/);
  assert.match(pdf, /\/Subtype \/Image/);
  assert.match(pdf, /\/Logo Do/);
  assert.match(pdf, /0\.067 0\.133 0\.200 rg/);
});
