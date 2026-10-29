export function escapeSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

export function requestMapFilters(requestAttributes = {}) {
  const requestId = escapeSql(requestAttributes.GlobalID);
  const resourceId = escapeSql(requestAttributes.ResourceGlobalID);
  const jobId = escapeSql(requestAttributes.WFMJobId);
  const movementClauses = [requestId && `RequestGlobalID='${requestId}'`, jobId && `WFMJobId='${jobId}'`].filter(Boolean);
  return {
    request: movementClauses.length ? `(${movementClauses.join(' OR ')})` : '1=0',
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
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return null;
  return {
    paths: [[[fromX, fromY], [toX, toY]]],
    spatialReference: { wkid: Number(attributes.ToWKID || attributes.FromWKID || feature.geometry?.spatialReference?.wkid || 4326) }
  };
}
