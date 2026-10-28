import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config.js';

test('accepts secured HTTPS deployment configuration', () => {
  assert.doesNotThrow(() => validateConfig({ portalUrl:'https://example.maps.arcgis.com', featureServiceUrl:'https://services.arcgis.com/x/FeatureServer', webmapId:'abc', workflow:{} }));
});

test('rejects insecure connection overrides', () => {
  assert.throws(() => validateConfig({ portalUrl:'http://example.com', featureServiceUrl:'https://example.com/FeatureServer', webmapId:'abc', workflow:{} }), /HTTPS/);
});
