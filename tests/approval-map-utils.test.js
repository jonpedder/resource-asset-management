import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackMovement, movementMidpoint, movementPath, plannedMovement, requestMapFilters } from '../src/approval-map-utils.js';

test('builds request and resource filters for the selected request', () => {
  assert.deepEqual(requestMapFilters({ GlobalID: "{REQ}'", ResourceGlobalID: '{RES}', WFMJobId: "JOB'1" }), {
    request: "RequestGlobalID='{REQ}'''",
    resource: "GlobalID='{RES}'"
  });
});

test('builds an origin-to-destination movement path', () => {
  const geometry = movementPath({
    attributes: { FromX: -116, FromY: 43, ToX: -115, ToY: 44, ToWKID: 4326 }
  });
  assert.equal(geometry.type, 'polyline');
  assert.deepEqual(geometry.paths[0][0], [-116, 43]);
  assert.deepEqual(geometry.paths[0].at(-1), [-115, 44]);
  assert.equal(geometry.paths[0].length, 25);
  assert.notEqual(geometry.paths[0][12][0], -115.5);
  assert.equal(geometry.spatialReference.wkid, 4326);
});

test('builds a planned deployment from the resource origin to the mobilization destination', () => {
  const movement=plannedMovement({GlobalID:'{REQ}',WFMJobId:'JOB',StatusBadge:'Mobilize / Dispatch',DeploymentSiteName:'Incident Base',DeploymentAddress:'100 Main St',DeploymentLongitude:-115,DeploymentLatitude:44,DestinationFacilityGlobalID:'{FAC}'},{attributes:{CurrentFacilityGlobalID:'{ORIGIN}',SiteName:'North Yard',CurrentAddress:'1 Yard Rd'},geometry:{x:-116,y:43,spatialReference:{wkid:4326}}});
  assert.equal(movement.attributes.MovementType,'Planned deployment');
  assert.equal(movement.attributes.FromSiteName,'North Yard');
  assert.equal(movement.attributes.ToSiteName,'Incident Base');
  assert.deepEqual(movementPath(movement).paths[0][0],[-116,43]);
  assert.deepEqual(movementPath(movement).paths[0].at(-1),[-115,44]);
  assert.equal(plannedMovement({DeploymentLongitude:-115},{geometry:{x:-116,y:43}}),null);
});

test('builds a fallback request movement from home to current resource location', () => {
  const movement=fallbackMovement({GlobalID:'{REQ}',RequestStatus:'Deployed'},{attributes:{HomeX:-116,HomeY:43,HomeSiteName:'Warehouse',SiteName:'Incident'},geometry:{x:-115,y:44,spatialReference:{wkid:4326}}});
  assert.equal(movement.attributes.MovementState,'Deployed');
  assert.equal(movement.attributes.FromSiteName,'Warehouse');
  assert.equal(movement.attributes.ToSiteName,'Incident');
});

test('calculates a label point at the movement line midpoint', () => {
  assert.deepEqual(movementMidpoint({ paths: [[[-116, 43], [-115, 44], [-114, 45]]], spatialReference: { wkid: 4326 } }), {
    type: 'point', x: -115, y: 44, spatialReference: { wkid: 4326 }
  });
});

test('uses destination feature geometry and rejects incomplete paths', () => {
  const path = movementPath({ attributes: { FromX: 1, FromY: 2 }, geometry: { x: 3, y: 4, spatialReference: { wkid: 4326 } } });
  assert.deepEqual(path.paths[0][0], [1, 2]);
  assert.deepEqual(path.paths[0].at(-1), [3, 4]);
  assert.equal(movementPath({ attributes: { FromX: 1, FromY: null, ToX: 3, ToY: 4 } }), null);
});
