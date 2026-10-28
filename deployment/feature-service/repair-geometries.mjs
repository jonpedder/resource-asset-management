const token = process.env.ARCCTL_TOKEN;
if (!token) throw new Error('ARCCTL_TOKEN is required in the environment.');

const source = 'https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/services/EOC_Resource_Inventory/FeatureServer';
const target = 'https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/services/Resource_Asset_Management_20261028/FeatureServer';
const outSR = 102100;

async function post(url, values) {
  const body = new URLSearchParams({ f: 'json', token, ...values });
  const response = await fetch(url, { method: 'POST', body });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(`${url}: ${json.error?.message || `ArcGIS request failed (${response.status})`}`);
  return json;
}

async function queryAll(layerUrl, fields) {
  const ids = await post(`${layerUrl}/query`, { where: '1=1', returnIdsOnly: 'true' });
  const objectIds = ids.objectIds || [];
  const rows = [];
  for (let i = 0; i < objectIds.length; i += 500) {
    const page = await post(`${layerUrl}/query`, {
      objectIds: objectIds.slice(i, i + 500).join(','),
      outFields: fields,
      returnGeometry: 'true',
      outSR: String(outSR)
    });
    rows.push(...(page.features || []));
  }
  return rows;
}

const normalize = value => String(value || '').trim().toLowerCase();
const isValidPoint = geometry => Number.isFinite(geometry?.x) && Number.isFinite(geometry?.y);

function uniqueBy(rows, keyField, label) {
  const map = new Map();
  for (const row of rows) {
    const key = normalize(row.attributes?.[keyField]);
    if (!key) throw new Error(`${label}: blank ${keyField} found.`);
    if (map.has(key)) throw new Error(`${label}: duplicate ${keyField} "${row.attributes[keyField]}" found; repair stopped.`);
    map.set(key, row);
  }
  return map;
}

function extent(rows) {
  const points = rows.map(row => row.geometry).filter(isValidPoint);
  return points.length ? {
    xmin: Math.min(...points.map(point => point.x)),
    ymin: Math.min(...points.map(point => point.y)),
    xmax: Math.max(...points.map(point => point.x)),
    ymax: Math.max(...points.map(point => point.y)),
    spatialReference: { wkid: outSR }
  } : null;
}

async function repair({ layerId, keyField, label }) {
  const sourceUrl = `${source}/${layerId}`;
  const targetUrl = `${target}/${layerId}`;
  const [sourceRows, targetRows] = await Promise.all([
    queryAll(sourceUrl, `OBJECTID,${keyField}`),
    queryAll(targetUrl, `OBJECTID,${keyField}`)
  ]);
  const sourceByKey = uniqueBy(sourceRows, keyField, `${label} source`);
  uniqueBy(targetRows, keyField, `${label} target`);
  const unmatched = targetRows.filter(row => !sourceByKey.has(normalize(row.attributes[keyField])));
  if (unmatched.length) throw new Error(`${label}: ${unmatched.length} target records have no source match; repair stopped.`);
  const invalid = sourceRows.filter(row => !isValidPoint(row.geometry));
  if (invalid.length) throw new Error(`${label}: ${invalid.length} source records have invalid or null geometry; repair stopped.`);

  const updates = targetRows.map(targetRow => {
    const sourceRow = sourceByKey.get(normalize(targetRow.attributes[keyField]));
    return {
      attributes: { OBJECTID: targetRow.attributes.OBJECTID },
      geometry: { ...sourceRow.geometry, spatialReference: { wkid: outSR, latestWkid: 3857 } }
    };
  });

  let updated = 0;
  for (let i = 0; i < updates.length; i += 200) {
    const result = await post(`${targetUrl}/updateFeatures`, {
      features: JSON.stringify(updates.slice(i, i + 200)),
      rollbackOnFailure: 'true'
    });
    const failures = (result.updateResults || []).filter(item => !item.success);
    if (failures.length) throw new Error(`${label}: ${failures.length} geometry updates failed.`);
    updated += (result.updateResults || []).length;
  }

  const verifiedRows = await queryAll(targetUrl, `OBJECTID,${keyField}`);
  const verifiedInvalid = verifiedRows.filter(row => !isValidPoint(row.geometry));
  if (verifiedRows.length !== targetRows.length || verifiedInvalid.length) throw new Error(`${label}: post-write verification failed.`);
  return {
    label,
    sourceCount: sourceRows.length,
    targetCount: targetRows.length,
    updated,
    beforeExtent: extent(targetRows),
    sourceExtent: extent(sourceRows),
    afterExtent: extent(verifiedRows)
  };
}

const report = {
  timestamp: new Date().toISOString(),
  operation: 'geometry-only repair from authoritative source',
  results: [
    await repair({ layerId: 0, keyField: 'ResourceName', label: 'Resources' }),
    await repair({ layerId: 1, keyField: 'SiteName', label: 'Facilities' })
  ]
};
console.log(JSON.stringify(report, null, 2));
