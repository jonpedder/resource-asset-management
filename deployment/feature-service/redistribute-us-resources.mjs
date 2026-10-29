import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const token = process.env.ARCCTL_TOKEN;
if (!token) throw new Error('ARCCTL_TOKEN is required in the environment.');

const service = 'https://services6.arcgis.com/SdBwj74JF24xKhpX/arcgis/rest/services/Resource_Asset_Management_20261028/FeatureServer';
const hubs = [
  { name: 'Pacific Northwest Regional Staging Area', city: 'Tacoma, WA', jurisdiction: 'FEMA Region X', x: -122.4443, y: 47.2529 },
  { name: 'Northern California Regional Staging Area', city: 'Sacramento, CA', jurisdiction: 'FEMA Region IX', x: -121.4944, y: 38.5816 },
  { name: 'Intermountain Regional Staging Area', city: 'Boise, ID', jurisdiction: 'FEMA Region X', x: -116.2023, y: 43.6150 },
  { name: 'Rocky Mountain Regional Staging Area', city: 'Denver, CO', jurisdiction: 'FEMA Region VIII', x: -104.9903, y: 39.7392 },
  { name: 'Southwest Regional Staging Area', city: 'Phoenix, AZ', jurisdiction: 'FEMA Region IX', x: -112.0740, y: 33.4484 },
  { name: 'Texas Regional Staging Area', city: 'Dallas, TX', jurisdiction: 'FEMA Region VI', x: -96.7970, y: 32.7767 },
  { name: 'Central Plains Regional Staging Area', city: 'Kansas City, MO', jurisdiction: 'FEMA Region VII', x: -94.5786, y: 39.0997 },
  { name: 'Great Lakes Regional Staging Area', city: 'Chicago, IL', jurisdiction: 'FEMA Region V', x: -87.6298, y: 41.8781 },
  { name: 'Southeast Regional Staging Area', city: 'Atlanta, GA', jurisdiction: 'FEMA Region IV', x: -84.3880, y: 33.7490 },
  { name: 'Gulf Coast Regional Staging Area', city: 'Mobile, AL', jurisdiction: 'FEMA Region IV', x: -88.0399, y: 30.6954 },
  { name: 'Mid-Atlantic Regional Staging Area', city: 'Harrisburg, PA', jurisdiction: 'FEMA Region III', x: -76.8867, y: 40.2732 },
  { name: 'Northeast Regional Staging Area', city: 'Worcester, MA', jurisdiction: 'FEMA Region I', x: -71.8023, y: 42.2626 }
];

async function post(url, values) {
  const body = new URLSearchParams({ f: 'json', token, ...values });
  const response = await fetch(url, { method: 'POST', body });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(`${url}: ${json.error?.message || response.status}`);
  return json;
}

async function queryAll(layerId, where = '1=1', outFields = '*', returnGeometry = true) {
  const url = `${service}/${layerId}`;
  const ids = await post(`${url}/query`, { where, returnIdsOnly: 'true' });
  const objectIds = ids.objectIds || [];
  const rows = [];
  for (let i = 0; i < objectIds.length; i += 400) {
    const page = await post(`${url}/query`, {
      objectIds: objectIds.slice(i, i + 400).join(','), outFields,
      returnGeometry: String(returnGeometry), outSR: '4326'
    });
    rows.push(...(page.features || []));
  }
  return rows;
}

async function updateInChunks(layerId, features) {
  let updated = 0;
  for (let i = 0; i < features.length; i += 150) {
    const result = await post(`${service}/${layerId}/updateFeatures`, {
      features: JSON.stringify(features.slice(i, i + 150)), rollbackOnFailure: 'true'
    });
    const failures = (result.updateResults || []).filter(item => !item.success);
    if (failures.length) throw new Error(`Layer ${layerId}: ${failures.length} updates failed: ${JSON.stringify(failures.slice(0, 3))}`);
    updated += result.updateResults.length;
  }
  return updated;
}

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

function resourcePoint(resource, hub) {
  const seed = hash(resource.attributes.GlobalID || resource.attributes.ResourceName || resource.attributes.OBJECTID);
  const angle = (seed % 3600) * Math.PI / 1800;
  const radiusKm = 2 + ((seed >>> 8) % 1300) / 100;
  const latitudeOffset = radiusKm / 111.32 * Math.sin(angle);
  const longitudeOffset = radiusKm / (111.32 * Math.cos(hub.y * Math.PI / 180)) * Math.cos(angle);
  return { x: hub.x + longitudeOffset, y: hub.y + latitudeOffset, spatialReference: { wkid: 4326 } };
}

const [resources, facilities, requests, movements] = await Promise.all([
  queryAll(0), queryAll(1), queryAll(2, 'ResourceGlobalID IS NOT NULL', 'ResourceGlobalID,RequestStatus', false),
  queryAll(3, '1=1', 'ResourceGlobalID,MovementState', false)
]);
if (facilities.length !== hubs.length) throw new Error(`Expected ${hubs.length} facilities but found ${facilities.length}; no edits were applied.`);

const protectedIds = new Set([
  ...requests.map(row => row.attributes.ResourceGlobalID),
  ...movements.map(row => row.attributes.ResourceGlobalID)
].filter(Boolean).map(value => String(value).replace(/[{}]/g, '').toLowerCase()));
const backupPath = join(tmpdir(), `resource-redistribution-backup-${Date.now()}.json`);
await writeFile(backupPath, JSON.stringify({ timestamp: new Date().toISOString(), resources, facilities }, null, 2));

const sortedFacilities = [...facilities].sort((a, b) => a.attributes.OBJECTID - b.attributes.OBJECTID);
const facilityUpdates = sortedFacilities.map((feature, index) => {
  const hub = hubs[index];
  return {
    attributes: {
      OBJECTID: feature.attributes.OBJECTID, SiteName: hub.name, FacilityType: 'Staging Area', Status: 'Open',
      Capacity: 150, Jurisdiction: hub.jurisdiction, Contact: 'Regional Logistics Coordinator',
      ContactPhone: `555-${String(210 + index * 31).padStart(3, '0')}-${String(4100 + index * 173).slice(-4)}`
    },
    geometry: { x: hub.x, y: hub.y, spatialReference: { wkid: 4326 } }
  };
});

const editable = resources.filter(resource => !protectedIds.has(String(resource.attributes.GlobalID || '').replace(/[{}]/g, '').toLowerCase()));
const resourceUpdates = editable.map(resource => {
  const a = resource.attributes;
  // OID rotation keeps every resource kind represented at many hubs instead of segregating kinds by geography.
  const hubIndex = (Number(a.OBJECTID) + hash(a.NIMS_Category || '') % hubs.length) % hubs.length;
  const hub = hubs[hubIndex];
  const facility = sortedFacilities[hubIndex];
  const point = resourcePoint(resource, hub);
  const facilityId = facility.attributes.GlobalID;
  return {
    attributes: {
      OBJECTID: a.OBJECTID, SiteName: hub.name, CurrentAddress: hub.city,
      CurrentFacilityGlobalID: facilityId, HomeFacilityGlobalID: facilityId, HomeSiteName: hub.name,
      HomeAddress: hub.city, HomeX: point.x, HomeY: point.y, HomeWKID: 4326,
      LocationVersion: Number(a.LocationVersion || 0) + 1, LastLocationUpdate: Date.now(),
      LastLocationUpdatedBy: 'demo-data-redistribution'
    },
    geometry: point
  };
});

const facilitiesUpdated = await updateInChunks(1, facilityUpdates);
const resourcesUpdated = await updateInChunks(0, resourceUpdates);

const verified = await queryAll(0, '1=1', 'OBJECTID,GlobalID,NIMS_Kind,SiteName', true);
const counts = Object.fromEntries(hubs.map(hub => [hub.name, verified.filter(row => row.attributes.SiteName === hub.name).length]));
const kindsByHub = Object.fromEntries(hubs.map(hub => [hub.name, new Set(verified.filter(row => row.attributes.SiteName === hub.name).map(row => row.attributes.NIMS_Kind).filter(Boolean)).size]));
const redistributed = verified.filter(row => hubs.some(hub => hub.name === row.attributes.SiteName));
const extent = {
  xmin: Math.min(...redistributed.map(row => row.geometry.x)), ymin: Math.min(...redistributed.map(row => row.geometry.y)),
  xmax: Math.max(...redistributed.map(row => row.geometry.x)), ymax: Math.max(...redistributed.map(row => row.geometry.y)),
  spatialReference: { wkid: 4326 }
};
if (redistributed.length !== resourceUpdates.length) throw new Error(`Verification failed: expected ${resourceUpdates.length} redistributed resources, found ${redistributed.length}.`);
if (Object.values(counts).some(count => count < 50) || Object.values(kindsByHub).some(count => count < 4)) throw new Error('Verification failed: one or more hubs lack a realistic resource mix.');

console.log(JSON.stringify({
  timestamp: new Date().toISOString(), backupFile: backupPath.split(/[\\/]/).pop(), totalResources: resources.length,
  protectedResources: resources.length - resourceUpdates.length, resourcesUpdated, facilitiesUpdated,
  extent, resourcesPerHub: counts, distinctKindsPerHub: kindsByHub
}, null, 2));
