import test from 'node:test';
import assert from 'node:assert/strict';
import { movementForStep, requiresMovementLocation, validateMovementLocation, buildMovement, buildResourceUpdate } from '../src/resource-movement.js';

test('requires geometry only for deployment and return confirmation', () => {
  assert.equal(requiresMovementLocation('Deploy / In Use'), true);
  assert.equal(requiresMovementLocation('Return & Restock'), true);
  assert.equal(requiresMovementLocation('Mobilize / Dispatch'), false);
  assert.equal(movementForStep('Return & Restock').resourceStatus, 'Available');
});

test('validates a destination with address and geometry', () => {
  const value = validateMovementLocation({ address: '100 Main St', geometry: { x: -116, y: 43, spatialReference: { wkid: 4326 } } });
  assert.equal(value.siteName, '100 Main St');
  assert.equal(value.geometry.spatialReference.wkid, 4326);
  assert.throws(() => validateMovementLocation({ address: 'Nowhere' }), /map location/i);
});

test('builds an auditable movement and preserves home location on first deployment', () => {
  const request = { attributes: { GlobalID: '{REQ}', ResourceGlobalID: '{RES}', WFMJobId: 'JOB-1' } };
  const resource = { attributes: { OBJECTID: 7, Status: 'En Route', SiteName: 'Staging', LocationVersion: 2 }, geometry: { x: 1, y: 2, spatialReference: { wkid: 4326 } } };
  const step = { stepId: 'deploy-1', stepName: 'Deploy / In Use' };
  const movement = buildMovement({ movementGlobalId: '{MOVE}', request, resource, step, location: { siteName: 'Incident Base', address: '100 Main St', geometry: { x: 3, y: 4, spatialReference: { wkid: 4326 } } }, username: 'operator', now: 10 });
  const edit = buildResourceUpdate(resource, movement, step.stepName);
  assert.equal(movement.attributes.FromSiteName, 'Staging');
  assert.equal(movement.attributes.ToSiteName, 'Incident Base');
  assert.equal(edit.attributes.Status, 'Committed');
  assert.equal(edit.attributes.HomeSiteName, 'Staging');
  assert.equal(edit.attributes.LocationVersion, 3);
});
