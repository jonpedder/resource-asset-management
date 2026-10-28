import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelpPdf } from '../src/help-pdf.js';

test('builds a directly downloadable branded help PDF with formatted topics', async () => {
  const topics=[{title:'Use the Operations workspace',blocks:[{kind:'subheading',text:'Resources and Facilities'},{kind:'paragraph',text:'Use the inventory tabs to switch lists.'},{kind:'list',text:'Select a resource to open the request pane.',ordered:true,number:1},{kind:'callout',text:'Workflow Manager is authoritative.'}]}];
  const blob=buildHelpPdf(topics,new Date('2026-10-28T18:00:00Z'),{appName:'County Emergency Management',colors:{navy:'#112233',accent:'#F0A000'}});
  assert.equal(blob.type,'application/pdf');
  const pdf=await blob.text();
  assert.match(pdf,/^%PDF-1\.4/);
  assert.match(pdf,/HELP & HOW-TO/);
  assert.match(pdf,/BT 0\.957 0\.969 0\.976 rg \/F2 15 Tf 118 758 Td \(County Emergency Management\) Tj ET/);
  assert.match(pdf,/IN THIS GUIDE/);
  assert.ok(pdf.indexOf('IN THIS GUIDE')<pdf.indexOf('Use the Operations workspace'));
  assert.match(pdf,/Use the Operations workspace/);
  assert.match(pdf,/Resources and Facilities/);
  assert.ok(Number(pdf.match(/\/Count (\d+)/)?.[1])>=2);
  assert.match(pdf,/Workflow Manager is authoritative/);
  assert.match(pdf,/%%EOF$/);
});

test('embeds interface images and paginates the help guide',async()=>{
  const image={bytes:new Uint8Array([0xff,0xd8,0xff,0xd9]),width:1,height:1};
  const topics=Array.from({length:12},(_,index)=>({title:`Topic ${index+1}`,blocks:[{kind:'image',imageKey:'operations-workspace',caption:'Annotated interface'},{kind:'paragraph',text:'Detailed operator instructions '.repeat(15)}]}));
  const pdf=await buildHelpPdf(topics,new Date(),{}, {'operations-workspace':image}).text();
  assert.match(pdf,/\/Subtype \/Image/);
  assert.match(pdf,/\/Img1 Do/);
  assert.ok(Number(pdf.match(/\/Count (\d+)/)?.[1])>1);
});
