import test from 'node:test';
import assert from 'node:assert/strict';
import { movementMidpoint, movementPath, requestMapFilters } from '../src/approval-map-utils.js';

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
  assert.deepEqual(geometry.paths, [[[-116, 43], [-115, 44]]]);
  assert.equal(geometry.spatialReference.wkid, 4326);
});

test('calculates a label point at the movement line midpoint', () => {
  assert.deepEqual(movementMidpoint({ paths: [[[-116, 43], [-114, 45]]], spatialReference: { wkid: 4326 } }), {
    type: 'point', x: -115, y: 44, spatialReference: { wkid: 4326 }
  });
});

test('uses destination feature geometry and rejects incomplete paths', () => {
  assert.deepEqual(movementPath({ attributes: { FromX: 1, FromY: 2 }, geometry: { x: 3, y: 4, spatialReference: { wkid: 4326 } } }).paths, [[[1, 2], [3, 4]]]);
  assert.equal(movementPath({ attributes: { FromX: 1, FromY: null, ToX: 3, ToY: 4 } }), null);
});
