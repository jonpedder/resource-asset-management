const token = process.env.ARCCTL_TOKEN;
if (!token) throw new Error('ARCCTL_TOKEN is required in the environment.');

const source = 'https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/services/EOC_Resource_Inventory/FeatureServer';
const target = 'https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/services/Resource_Asset_Management_20261028/FeatureServer';

async function post(url, values) {
  const body = new URLSearchParams({ f: 'json', token, ...values });
  const response = await fetch(url, { method: 'POST', body });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(json.error?.message || `ArcGIS request failed (${response.status})`);
  return json;
}

async function queryAll(layerUrl, returnGeometry = true) {
  const ids = await post(`${layerUrl}/query`, { where: '1=1', returnIdsOnly: 'true' });
  const objectIds = ids.objectIds || [];
  if (!objectIds.length) return [];
  const chunks = [];
  for (let i = 0; i < objectIds.length; i += 500) chunks.push(objectIds.slice(i, i + 500));
  const rows = [];
  for (const chunk of chunks) {
    // Keep migrated geometry in the target service's Web Mercator spatial reference.
    // Inserting bare WGS84 coordinates into a Web Mercator layer places features near Null Island.
    const page = await post(`${layerUrl}/query`, { objectIds: chunk.join(','), outFields: '*', returnGeometry: String(returnGeometry), outSR: '102100' });
    rows.push(...(page.features || []));
  }
  return rows;
}

function cleanAttributes(attributes, targetFields) {
  const allowed = new Set(targetFields.filter(f => !['esriFieldTypeOID', 'esriFieldTypeGlobalID'].includes(f.type)).map(f => f.name));
  return Object.fromEntries(Object.entries(attributes || {}).filter(([key]) => allowed.has(key)));
}

async function migrate({ layerId, keyField, label }) {
  const sourceUrl = `${source}/${layerId}`;
  const targetUrl = `${target}/${layerId}`;
  const [sourceRows, targetRows, targetInfo] = await Promise.all([queryAll(sourceUrl), queryAll(targetUrl), post(targetUrl, {})]);
  const existing = new Set(targetRows.map(f => String(f.attributes?.[keyField] || '').trim().toLowerCase()).filter(Boolean));
  const additions = sourceRows
    .filter(f => !existing.has(String(f.attributes?.[keyField] || '').trim().toLowerCase()))
    .map(f => ({ attributes: cleanAttributes(f.attributes, targetInfo.fields || []), geometry: { ...f.geometry, spatialReference: { wkid: 102100, latestWkid: 3857 } } }));
  let added = 0;
  for (let i = 0; i < additions.length; i += 200) {
    const result = await post(`${targetUrl}/addFeatures`, { features: JSON.stringify(additions.slice(i, i + 200)), rollbackOnFailure: 'true' });
    const failures = (result.addResults || []).filter(r => !r.success);
    if (failures.length) throw new Error(`${label}: ${failures.length} feature additions failed.`);
    added += (result.addResults || []).length;
  }
  const finalRows = await queryAll(targetUrl, false);
  return { label, sourceCount: sourceRows.length, existingCount: targetRows.length, added, finalCount: finalRows.length };
}

let sourceRequests = [];
let sourceRequestsNote = '';
try { sourceRequests = await queryAll(`${source}/2`, false); }
catch (error) { sourceRequestsNote = `The configured legacy ResourceRequests endpoint is unavailable: ${error.message}`; }
let targetRequests = [];
let targetRequestsNote = '';
try { targetRequests = await queryAll(`${target}/2`, false); }
catch (error) { targetRequestsNote = `The target ResourceRequests endpoint is unavailable: ${error.message}`; }
const report = {
  timestamp: new Date().toISOString(),
  source,
  target,
  results: [
    await migrate({ layerId: 0, keyField: 'ResourceName', label: 'Resources' }),
    await migrate({ layerId: 1, keyField: 'SiteName', label: 'Facilities' })
  ],
  requests: {
    sourceCount: sourceRequests.length,
    targetCount: targetRequests.length,
    migrated: false,
    reason: [sourceRequestsNote, targetRequestsNote, 'Historical requests are excluded because each request must be transactionally linked to exactly one new Workflow Manager job.'].filter(Boolean).join(' ')
  }
};
console.log(JSON.stringify(report, null, 2));