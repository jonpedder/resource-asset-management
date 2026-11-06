import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sharedResourceSymbol, SHARED_FACILITY_SYMBOL_URL, SHARED_RESOURCE_SYMBOLS } from '../src/shared-symbology.js';

test('resource and facility lists share the Asset Management icon catalog', async () => {
  assert.equal(sharedResourceSymbol({ NIMS_Category: 'Communications' }).icon, 'tower-broadcast');
  assert.equal(sharedResourceSymbol({ NIMS_Category: 'Public Works' }).icon, 'helmet-safety');
  assert.equal(sharedResourceSymbol({ ResourceName: 'Ambulance 12' }).icon, 'kit-medical');
  assert.equal(sharedResourceSymbol({ NIMS_Category: 'Unknown' }).icon, 'boxes-stacked');
  assert.equal(SHARED_RESOURCE_SYMBOLS.length, 14);
  assert.match(SHARED_FACILITY_SYMBOL_URL, /asset-management\/main\/assets\/resource-icons\/facility-management\.svg$/);
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /listIcon\(sharedResourceSymbol\(a\)\.url\)/);
  assert.match(source, /listIcon\(SHARED_FACILITY_SYMBOL_URL\)/);
});

test('both applications target the same feature service item', async () => {
  const config = JSON.parse(await readFile(new URL('../app-config.json', import.meta.url), 'utf8'));
  assert.equal(config.featureServiceItemId, '6cca40eeed1d4fb39c0885f4ffd223f3');
  assert.match(config.featureServiceUrl, /Resource_Asset_Management_20261028\/FeatureServer$/);
});
