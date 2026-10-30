export function escapeSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

export function requestMapFilters(requestAttributes = {}) {
  const requestId = escapeSql(requestAttributes.GlobalID);
  const resourceId = escapeSql(requestAttributes.ResourceGlobalID);
  const jobId = escapeSql(requestAttributes.WFMJobId);
  return {
    request: requestId ? `RequestGlobalID='${requestId}'` : (jobId ? `WFMJobId='${jobId}'` : '1=0'),
    resource: resourceId ? `GlobalID='${resourceId}'` : '1=0'
  };
}

function coordinate(value) {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

export function movementPath(feature = {}) {
  const attributes = feature.attributes || {};
  const fromX = coordinate(attributes.FromX);
  const fromY = coordinate(attributes.FromY);
  const toX = coordinate(attributes.ToX ?? feature.geometry?.x);
  const toY = coordinate(attributes.ToY ?? feature.geometry?.y);
  if (![fromX, fromY, toX, toY].every(Number.isFinite) || (fromX === toX && fromY === toY)) return null;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  const bend = distance * 0.18;
  const controlX = (fromX + toX) / 2 - (distance ? dy / distance * bend : 0);
  const controlY = (fromY + toY) / 2 + (distance ? dx / distance * bend : 0);
  const vertices = Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    const inverse = 1 - t;
    return [
      inverse * inverse * fromX + 2 * inverse * t * controlX + t * t * toX,
      inverse * inverse * fromY + 2 * inverse * t * controlY + t * t * toY
    ];
  });
  return {
    type: 'polyline',
    paths: [vertices],
    spatialReference: { wkid: Number(attributes.ToWKID || attributes.FromWKID || feature.geometry?.spatialReference?.wkid || 4326) }
  };
}

export function plannedMovement(requestAttributes = {}, resource = {}) {
  const a = resource.attributes || {};
  const origin = resource.geometry || {};
  const fromX = coordinate(origin.x);
  const fromY = coordinate(origin.y);
  const toX = coordinate(requestAttributes.DeploymentLongitude);
  const toY = coordinate(requestAttributes.DeploymentLatitude);
  if (![fromX, fromY, toX, toY].every(Number.isFinite) || (fromX === toX && fromY === toY)) return null;
  return {
    geometry: { x: toX, y: toY, spatialReference: { wkid: 4326 } },
    attributes: {
      RequestGlobalID: requestAttributes.GlobalID,
      WFMJobId: requestAttributes.WFMJobId,
      MovementType: 'Planned deployment',
      MovementState: requestAttributes.StatusBadge || 'Mobilize / Dispatch',
      FromFacilityGlobalID: a.CurrentFacilityGlobalID || a.HomeFacilityGlobalID || '',
      FromSiteName: a.SiteName || a.HomeSiteName || 'Resource origin',
      FromAddress: a.CurrentAddress || a.HomeAddress || '',
      ToFacilityGlobalID: requestAttributes.DestinationFacilityGlobalID || '',
      ToSiteName: requestAttributes.DeploymentSiteName || requestAttributes.DeploymentAddress || 'Deployment destination',
      DeploymentAddress: requestAttributes.DeploymentAddress || '',
      FromX: fromX, FromY: fromY, FromWKID: origin.spatialReference?.latestWkid || origin.spatialReference?.wkid || 4326,
      ToX: toX, ToY: toY, ToWKID: 4326
    }
  };
}

export function fallbackMovement(requestAttributes = {}, resource = {}) {
  const a = resource.attributes || {};
  const geometry = resource.geometry || {};
  const fromX = coordinate(a.HomeX);
  const fromY = coordinate(a.HomeY);
  const toX = coordinate(geometry.x);
  const toY = coordinate(geometry.y);
  if (![fromX, fromY, toX, toY].every(Number.isFinite) || (fromX === toX && fromY === toY)) return null;
  return {
    geometry: { x: toX, y: toY, spatialReference: geometry.spatialReference || { wkid: 4326 } },
    attributes: {
      RequestGlobalID: requestAttributes.GlobalID,
      WFMJobId: requestAttributes.WFMJobId,
      MovementType: 'Current request',
      MovementState: requestAttributes.RequestStatus || requestAttributes.StatusBadge || 'Current',
      FromSiteName: a.HomeSiteName || 'Origin',
      ToSiteName: a.SiteName || 'Current location',
      FromX: fromX, FromY: fromY, FromWKID: a.HomeWKID || 4326,
      ToX: toX, ToY: toY, ToWKID: geometry.spatialReference?.wkid || 4326
    }
  };
}

export function movementMidpoint(path) {
  const vertices = path?.paths?.[0] || [];
  const midpoint = vertices[Math.floor(vertices.length / 2)];
  if (!midpoint) return null;
  return {
    type: 'point',
    x: Number(midpoint[0]),
    y: Number(midpoint[1]),
    spatialReference: path.spatialReference
  };
}

export function movementDirectionMarker(path, fraction = 0.72) {
  const vertices = path?.paths?.[0] || [];
  if (vertices.length < 2) return null;
  const index = Math.min(vertices.length - 2, Math.max(0, Math.round((vertices.length - 1) * fraction)));
  const start = vertices[index], end = vertices[index + 1];
  const dx = Number(end[0]) - Number(start[0]), dy = Number(end[1]) - Number(start[1]);
  if (![dx, dy].every(Number.isFinite) || (!dx && !dy)) return null;
  return {
    geometry: {
      type: 'point',
      x: (Number(start[0]) + Number(end[0])) / 2,
      y: (Number(start[1]) + Number(end[1])) / 2,
      spatialReference: path.spatialReference
    },
    angle: 90 - Math.atan2(dy, dx) * 180 / Math.PI
  };
}
