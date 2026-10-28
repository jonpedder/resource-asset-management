const token = process.env.ARCCTL_TOKEN;
if (!token) throw new Error('ARCCTL_TOKEN is required.');

const tableUrl = 'https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/services/Resource_Asset_Management_20261028/FeatureServer/2';

async function post(path, values = {}) {
  const body = new URLSearchParams({ f: 'json', token, ...values });
  const response = await fetch(`${tableUrl}${path}`, { method: 'POST', body });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(json.error?.message || `ArcGIS request failed (${response.status})`);
  return json;
}

const before = await post('/query', { where: '1=1', returnIdsOnly: 'true' });
const objectIds = before.objectIds || [];
let deleted = 0;
for (let i = 0; i < objectIds.length; i += 500) {
  const result = await post('/deleteFeatures', { objectIds: objectIds.slice(i, i + 500).join(','), rollbackOnFailure: 'true' });
  const failures = (result.deleteResults || []).filter(row => !row.success);
  if (failures.length) throw new Error(`Failed to delete ${failures.length} request record(s).`);
  deleted += (result.deleteResults || []).length;
}
const after = await post('/query', { where: '1=1', returnCountOnly: 'true' });
if (after.count !== 0) throw new Error(`Cleanup verification failed: ${after.count} request record(s) remain.`);
console.log(JSON.stringify({ tableUrl, beforeCount: objectIds.length, deleted, finalCount: after.count, verified: true }, null, 2));
