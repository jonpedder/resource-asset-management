import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditPdf, buildRequestPdf, buildResourceReportPdf, buildResourceSummaryPdf, buildResourceLocationSummaryPdf } from '../src/audit-pdf.js';

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
  assert.match(pdf, /\/F2 15 Tf 118 758 Td \(Resource & Asset Management\)/);
  assert.match(pdf, /Asset deployed/);
  assert.match(pdf, /%%EOF$/);
});

test('embeds a movement map at the top of the audit report', async () => {
  const mapImage={bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:2,height:1};
  const pdf=await buildAuditPdf({RequestTitle:'Mapped Audit'},[{title:'Moved'}],new Date(),{mapImage}).text();
  assert.match(pdf,/\/MapImage \d+ 0 R/);
  assert.match(pdf,/\/MapImage Do/);
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

test('builds a mapped resource report with hub, kind, and NIMS typing totals', async () => {
  const hubs=[{name:'Texas Regional Staging Area',total:84,kinds:{Aircraft:5,Equipment:22,Facilities:3,Personnel:15,Supplies:5,Teams:34},types:{'Type I':10,'Type II':29,'Type III':28,'Type IV':9,NA:8},resources:[{name:'Portable Generator 12',capabilities:'Emergency power generation',kind:'Equipment',nimsType:'Type II',agency:'Texas Emergency Management',location:'Austin / Texas Regional Staging Area',availability:'Available',quantity:2,updated:'2026-10-29T17:00:00Z'}]}];
  const mapImage={bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:2,height:1};
  const pdf=await buildResourceReportPdf(hubs,new Date('2026-10-29T18:00:00Z'),{mapImage}).text();
  assert.match(pdf,/RESOURCE REPORT/);
  assert.match(pdf,/RESOURCES BY STAGING AREA/);
  assert.match(pdf,/RESOURCES BY STAGING AREA AND KIND/);
  assert.match(pdf,/RESOURCES BY STAGING AREA AND NIMS TYPE/);
  assert.match(pdf,/SUPPORTING RESOURCE DETAIL/);
  assert.match(pdf,/HOW TO INTERPRET THIS REPORT/);
  assert.match(pdf,/Texas Regional Staging Area/);
  assert.match(pdf,/Equipment/);
  assert.match(pdf,/Type II/);
  assert.match(pdf,/Portable Generator 12/);
  assert.match(pdf,/Emergency power generation/);
  assert.match(pdf,/Texas Emergency Management/);
  assert.match(pdf,/Currently available to deploy/);
  assert.match(pdf,/One resource equals one feature record/);
  assert.match(pdf,/NA means no NIMS type is recorded/);
  assert.match(pdf,/\/F1 10 Tf/);
  assert.match(pdf,/\/MapImage Do/);
});

test('builds a concise mapped resource summary without supporting detail',async()=>{
  const hubs=[{name:'Texas Regional Staging Area',total:84,kinds:{Equipment:22,Teams:34},types:{'Type II':29,NA:8},resources:[{availability:'Available'}]}];
  const mapImage={bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:2,height:1};
  const pdf=await buildResourceSummaryPdf(hubs,new Date('2026-10-29T18:00:00Z'),{mapImage}).text();
  assert.match(pdf,/RESOURCE SUMMARY/);
  assert.match(pdf,/NATIONAL TOTALS BY RESOURCE KIND/);
  assert.match(pdf,/NATIONAL TOTALS BY NIMS TYPE/);
  assert.match(pdf,/Texas Regional Staging Area/);
  assert.doesNotMatch(pdf,/SUPPORTING RESOURCE DETAIL/);
  assert.match(pdf,/\/MapImage Do/);
});

test('builds a mapped resource summary grouped by recorded location',async()=>{
  const hubs=[{name:'Texas Regional Staging Area',total:2,kinds:{Equipment:2},types:{'Type II':2},resources:[{location:'Austin / Texas Regional Staging Area',kind:'Equipment',nimsType:'Type II',availability:'Available'},{location:'Austin / Texas Regional Staging Area',kind:'Equipment',nimsType:'Type II',availability:'Committed'}]}];
  const mapImage={bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:2,height:1};
  const pdf=await buildResourceLocationSummaryPdf(hubs,new Date('2026-10-29T18:00:00Z'),{mapImage}).text();
  assert.match(pdf,/RESOURCE SUMMARY BY LOCATION/);
  assert.match(pdf,/LOCATION SUMMARY/);
  assert.match(pdf,/RESOURCE KINDS BY LOCATION/);
  assert.match(pdf,/NIMS TYPES BY LOCATION/);
  assert.match(pdf,/Austin \/ Texas Regional Staging Area/);
  assert.match(pdf,/\/MapImage Do/);
});

test('builds a directly downloadable branded request PDF', async () => {
  const pdf = await buildRequestPdf({ RequestTitle: 'Generator Request', IncidentName: 'Storm Response', RequestedKind: 'Generator', Notes: 'Deliver to staging.' }, new Date('2026-10-28T18:00:00Z'), { appName: 'County Emergency Management' }, 'Alex Approver').text();
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /RESOURCE REQUEST REPORT/);
  assert.match(pdf, /Generator Request/);
  assert.match(pdf, /Storm Response/);
  assert.match(pdf, /Deliver to staging/);
  assert.match(pdf, /Alex Approver/);
  assert.match(pdf, /%%EOF$/);
});
