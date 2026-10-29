const token = process.env.ARCCTL_TOKEN;
if (!token) throw new Error('ARCCTL_TOKEN is required in the environment.');

const portal = 'https://publicsafety.maps.arcgis.com';
const owner = 'JonPSO';
const itemId = '6cca40eeed1d4fb39c0885f4ffd223f3';
const extent = '-124.9,24.4,-66.8,49.5';

const body = new URLSearchParams({ f: 'json', token, extent });
const response = await fetch(`${portal}/sharing/rest/content/users/${owner}/items/${itemId}/update`, { method: 'POST', body });
const json = await response.json();
if (!response.ok || json.error || json.success !== true) throw new Error(json.error?.message || `Item extent update failed (${response.status}).`);
console.log(JSON.stringify({ itemId, extent, success: true }, null, 2));
