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
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return null;
  return {
    paths: [[[fromX, fromY], [toX, toY]]],
    spatialReference: { wkid: Number(attributes.ToWKID || attributes.FromWKID || feature.geometry?.spatialReference?.wkid || 4326) }
  };
}

export function movementMidpoint(path) {
  const [source, destination] = path?.paths?.[0] || [];
  if (!source || !destination) return null;
  return {
    type: 'point',
    x: (Number(source[0]) + Number(destination[0])) / 2,
    y: (Number(source[1]) + Number(destination[1])) / 2,
    spatialReference: path.spatialReference
  };
}
