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
    paths: [vertices],
    spatialReference: { wkid: Number(attributes.ToWKID || attributes.FromWKID || feature.geometry?.spatialReference?.wkid || 4326) }
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
