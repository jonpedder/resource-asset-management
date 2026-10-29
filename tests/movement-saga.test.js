import test from 'node:test';
import assert from 'node:assert/strict';
import { executeMovementSaga } from '../src/movement-saga.js';

function fixture({ failWorkflow = false } = {}) {
  const calls=[];
  let resource={ attributes:{ OBJECTID:1, GlobalID:'{RES}', Status:'En Route', SiteName:'Staging', LocationVersion:0 }, geometry:{x:1,y:2,spatialReference:{wkid:4326}} };
  const client={
    async oneByGlobalId(){ calls.push('read'); return structuredClone(resource); },
    async query(){ calls.push('movement-query'); return []; },
    async applyServiceEdits(edits){ calls.push(edits); const update=edits.find(e=>e.id===0)?.updates?.[0]; if(update) resource={attributes:{...resource.attributes,...update.attributes},geometry:update.geometry||resource.geometry}; }
  };
  const workflow={
    async completeStep(){ calls.push('workflow'); if(failWorkflow) throw new Error('WFM failed'); },
    async addComment(){ calls.push('comment'); }
  };
  return { calls, client, workflow, request:{attributes:{OBJECTID:2,GlobalID:'{REQ}',ResourceGlobalID:'{RES}',WFMJobId:'JOB'}}, step:{stepId:'S1',stepName:'Deploy / In Use'}, action:{response:null}, location:{siteName:'Base',address:'100 Main',geometry:{x:3,y:4,spatialReference:{wkid:4326}}} };
}

test('moves GIS atomically before workflow and confirms the movement', async()=>{
  const f=fixture();
  await executeMovementSaga({...f,layers:{resources:0,requests:2,movements:3},note:'Arrived',username:'op',now:()=>100,movementGlobalId:'{MOVE}'});
  assert.equal(f.calls[0],'read');
  assert.equal(f.calls[1],'movement-query');
  assert.equal(f.calls[2][0].id,0);
  assert.equal(f.calls[4],'workflow');
  assert.equal(f.calls.at(-1),'comment');
});

test('compensates the GIS move when workflow completion fails', async()=>{
  const f=fixture({failWorkflow:true});
  await assert.rejects(()=>executeMovementSaga({...f,layers:{resources:0,requests:2,movements:3},note:'Arrived',username:'op',now:()=>100,movementGlobalId:'{MOVE}'}),/WFM failed/);
  const rollback=f.calls.find(call=>Array.isArray(call)&&call.some(e=>e.updates?.[0]?.attributes?.MovementState==='Reverted'));
  assert.ok(rollback);
  assert.equal(rollback.find(e=>e.id===0).updates[0].geometry.x,1);
});
