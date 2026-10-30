import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentLocationAttributes, normalizeGlobalId, requestDeploymentLocation, resourceOriginLocation } from '../src/movement-location.js';

const facilityLocation = feature => ({
  facilityGlobalId: feature.attributes.GlobalID,
  siteName: feature.attributes.FacilityName,
  address: feature.attributes.FullAddress,
  geometry: feature.geometry
});

test('matches the current facility despite GUID brace or case differences and keeps resource coordinates', () => {
  const resource = {
    attributes: { CurrentFacilityGlobalID: '{ABC-123}', HomeFacilityGlobalID: '{HOME}', SiteName: 'Resource staging', CurrentAddress: '10 Current Rd' },
    geometry: { x: -116.2, y: 43.6, spatialReference: { wkid: 4326 } }
  };
  const facilities = [{ attributes: { GlobalID: 'abc-123', FacilityName: 'North Yard', FullAddress: '20 Yard Rd' }, geometry: { x: -116, y: 43, spatialReference: { wkid: 4326 } } }];
  const result = resourceOriginLocation(resource, facilities, facilityLocation);
  assert.equal(normalizeGlobalId('{ABC-123}'), 'abc-123');
  assert.equal(result.matchedFacility, facilities[0]);
  assert.equal(result.location.facilityGlobalId, 'abc-123');
  assert.equal(result.location.siteName, 'Resource staging');
  assert.equal(result.location.address, '10 Current Rd');
  assert.deepEqual(result.location.geometry, resource.geometry);
});

test('round-trips a deployment location saved during mobilization', () => {
  const location = { facilityGlobalId: '{FAC}', siteName: 'Incident Base', address: '100 Main St', geometry: { x: -116.1, y: 43.5, spatialReference: { wkid: 4326 } } };
  const saved = deploymentLocationAttributes(location);
  assert.deepEqual(requestDeploymentLocation(saved), location);
  assert.equal(requestDeploymentLocation({ DeploymentSiteName: 'Missing point' }), null);
});

test('falls back to the home facility and its saved location', () => {
  const facilities = [{ attributes: { GlobalID: '{HOME}', FacilityName: 'Home Depot', FullAddress: '1 Home St' }, geometry: { x: -115, y: 42, spatialReference: { wkid: 4326 } } }];
  const result = resourceOriginLocation({ attributes: { HomeFacilityGlobalID: '{home}' } }, facilities, facilityLocation);
  assert.equal(result.location.facilityGlobalId, '{HOME}');
  assert.equal(result.location.siteName, 'Home Depot');
  assert.equal(result.location.address, '1 Home St');
  assert.deepEqual(result.location.geometry, facilities[0].geometry);
});
