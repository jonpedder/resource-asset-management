import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config.js';

test('accepts secured HTTPS deployment configuration', () => {
  assert.doesNotThrow(() => validateConfig({ portalUrl:'https://example.maps.arcgis.com', featureServiceUrl:'https://services.arcgis.com/x/FeatureServer', webmapId:'abc', workflow:{} }));
});

test('rejects insecure connection overrides', () => {
  assert.throws(() => validateConfig({ portalUrl:'http://example.com', featureServiceUrl:'https://example.com/FeatureServer', webmapId:'abc', workflow:{} }), /HTTPS/);
});

test('accepts a configurable quantity-label scale and rejects invalid values', () => {
  const base={ portalUrl:'https://example.com', featureServiceUrl:'https://example.com/FeatureServer', webmapId:'abc', workflow:{} };
  assert.doesNotThrow(() => validateConfig({ ...base, map:{ quantityLabelMinScale:75000 } }));
  assert.throws(() => validateConfig({ ...base, map:{ quantityLabelMinScale:-1 } }), /minimum scale/);
});
