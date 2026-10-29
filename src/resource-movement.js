export const MOVEMENT_STEPS = Object.freeze({
  'Deploy / In Use': { type: 'Deploy', requiresLocation: true, resourceStatus: 'Committed', requestState: 'Deployed' },
  'Return & Restock': { type: 'Return', requiresLocation: true, resourceStatus: 'Available', requestState: 'Returned' }
});

export function movementForStep(stepName) { return MOVEMENT_STEPS[stepName] || null; }
export function requiresMovementLocation(stepName) { return Boolean(movementForStep(stepName)?.requiresLocation); }

export function normalizePoint(point) {
  const x = Number(point?.x), y = Number(point?.y);
  const wkid = Number(point?.spatialReference?.latestWkid || point?.spatialReference?.wkid || point?.wkid || 4326);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('A valid deployment or return map location is required.');
  return { x, y, spatialReference: { wkid } };
}

export function validateMovementLocation(location) {
  const geometry = normalizePoint(location?.geometry || location);
  const siteName = String(location?.siteName || '').trim();
  const address = String(location?.address || '').trim();
  if (!siteName && !address) throw new Error('Enter a site name or deployment address for the selected location.');
  return { ...location, geometry, siteName: siteName || address, address };
}

export function guid() {
  const value = globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
  return `{${value.toUpperCase()}}`;
}

export function buildMovement({ movementGlobalId, request, resource, step, location, username, now = Date.now() }) {
  const rule = movementForStep(step.stepName);
  if (!rule) throw new Error(`No resource movement is configured for ${step.stepName}.`);
  const to = validateMovementLocation(location);
  const from = normalizePoint(resource.geometry);
  const a = resource.attributes || {};
  const r = request.attributes || request;
  return {
    geometry: to.geometry,
    attributes: {
      GlobalID: movementGlobalId,
      ResourceGlobalID: r.ResourceGlobalID,
      RequestGlobalID: r.GlobalID,
      WFMJobId: r.WFMJobId,
      WorkflowStepId: step.stepId,
      WorkflowStepName: step.stepName,
      IdempotencyKey: `${r.WFMJobId}:${step.stepId}:${r.ResourceGlobalID}:${rule.type}`,
      MovementType: rule.type,
      MovementState: 'Applied',
      FromFacilityGlobalID: a.CurrentFacilityGlobalID || a.HomeFacilityGlobalID || '',
      FromSiteName: a.SiteName || '',
      FromAddress: a.CurrentAddress || '',
      FromX: from.x,
      FromY: from.y,
      FromWKID: from.spatialReference.wkid,
      ToFacilityGlobalID: to.facilityGlobalId || '',
      ToSiteName: to.siteName,
      DeploymentAddress: to.address,
      ToX: to.geometry.x,
      ToY: to.geometry.y,
      ToWKID: to.geometry.spatialReference.wkid,
      MovedBy: username || '',
      MovedDate: now,
      IntegrationError: ''
    }
  };
}

export function buildResourceUpdate(resource, movement, stepName) {
  const rule = movementForStep(stepName);
  const before = resource.attributes || {};
  const m = movement.attributes;
  const deployHome = rule.type === 'Deploy' && (before.HomeX === null || before.HomeX === undefined || before.HomeX === '') && (before.HomeY === null || before.HomeY === undefined || before.HomeY === '');
  return {
    geometry: movement.geometry,
    attributes: {
      OBJECTID: before.OBJECTID,
      GlobalID: before.GlobalID,
      Status: rule.resourceStatus,
      SiteName: m.ToSiteName,
      CurrentAddress: m.DeploymentAddress,
      CurrentFacilityGlobalID: m.ToFacilityGlobalID,
      LocationVersion: Number(before.LocationVersion || 0) + 1,
      LastLocationUpdate: m.MovedDate,
      LastLocationUpdatedBy: m.MovedBy,
      ...(deployHome ? {
        HomeFacilityGlobalID: m.FromFacilityGlobalID,
        HomeSiteName: m.FromSiteName,
        HomeAddress: m.FromAddress,
        HomeX: m.FromX,
        HomeY: m.FromY,
        HomeWKID: m.FromWKID
      } : {})
    }
  };
}

export function rollbackResourceUpdate(resourceBefore, objectId, nextVersion) {
  const a = resourceBefore.attributes || {};
  return {
    geometry: normalizePoint(resourceBefore.geometry),
    attributes: {
      OBJECTID: objectId,
      Status: a.Status || null,
      SiteName: a.SiteName || null,
      CurrentAddress: a.CurrentAddress || null,
      CurrentFacilityGlobalID: a.CurrentFacilityGlobalID || null,
      LocationVersion: nextVersion,
      LastLocationUpdate: a.LastLocationUpdate || null,
      LastLocationUpdatedBy: a.LastLocationUpdatedBy || null,
      HomeFacilityGlobalID: a.HomeFacilityGlobalID || null,
      HomeSiteName: a.HomeSiteName || null,
      HomeAddress: a.HomeAddress || null,
      HomeX: a.HomeX ?? null,
      HomeY: a.HomeY ?? null,
      HomeWKID: a.HomeWKID ?? null
    }
  };
}
