import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResourceSummaryPdf, buildResourceLocationSummaryPdf, buildFacilityReportPdf, buildRequestQueueReportPdf } from '../src/audit-pdf.js';

const mapImage={bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:2,height:1};
const hubs=[{name:'Texas Regional Staging Area',total:1,kinds:{Equipment:1},types:{'Type II':1},resources:[{location:'Austin',kind:'Equipment',nimsType:'Type II',availability:'Available'}]}];

test('resource summaries include a yellow-to-red density legend on mapped output',async()=>{
  for(const build of [buildResourceSummaryPdf,buildResourceLocationSummaryPdf]){
    const pdf=await build(hubs,new Date('2026-10-30T12:00:00Z'),{mapImage}).text();
    assert.match(pdf,/Resource density/); assert.match(pdf,/Low/); assert.match(pdf,/High/);
    assert.match(pdf,/1\.000 1\.000 0\.000 rg/); assert.match(pdf,/1\.000 0\.000 0\.000 rg/);
  }
});

test('builds a mapped facility inventory report',async()=>{
  const pdf=await buildFacilityReportPdf([{name:'Central Shelter',type:'Shelter',status:'Open',location:'Austin',coordinates:'30.1, -97.7',capacity:'250',jurisdiction:'Travis County',contact:'Alex',phone:'555-0100',globalId:'{FAC}'}],new Date('2026-10-30T12:00:00Z'),{mapImage}).text();
  assert.match(pdf,/FACILITY REPORT/); assert.match(pdf,/Central Shelter/); assert.match(pdf,/Travis County/); assert.match(pdf,/\/MapImage Do/);
});

test('builds a mapped pending request queue report with locations',async()=>{
  const pdf=await buildRequestQueueReportPdf([{title:'Generator request',incident:'Storm',requestor:'Taylor',priority:'Urgent',category:'Equipment',kind:'Generator',type:'Type II',quantity:2,dateNeeded:'Tomorrow',status:'Submitted',location:'Austin',jobId:'JOB-1',mapped:true},{title:'Water request',status:'Submitted',location:'Location unavailable',mapped:false}],new Date('2026-10-30T12:00:00Z'),{mapImage}).text();
  assert.match(pdf,/REQUEST QUEUE REPORT/); assert.match(pdf,/Pending requests/); assert.match(pdf,/Mapped locations/); assert.match(pdf,/Generator request/); assert.match(pdf,/Austin/); assert.match(pdf,/Location unavailable/); assert.match(pdf,/\/MapImage Do/);
});
