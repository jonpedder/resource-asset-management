import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config.js';

test('accepts secured HTTPS deployment configuration', () => {
  assert.doesNotThrow(() => validateConfig({ portalUrl:'https://example.maps.arcgis.com', featureServiceUrl:'https://services.arcgis.com/x/FeatureServer', webmapId:'abc', workflow:{} }));
});

test('rejects insecure connection overrides', () => {
  assert.throws(() => validateConfig({ portalUrl:'http://example.com', featureServiceUrl:'https://example.com/FeatureServer', webmapId:'abc', workflow:{} }), /HTTPS/);
});

test('validates the configurable resource selection zoom scale', () => {
  const base={ portalUrl:'https://example.com', featureServiceUrl:'https://example.com/FeatureServer', webmapId:'abc', workflow:{} };
  assert.doesNotThrow(() => validateConfig({ ...base, mapNavigation:{ resourceSelectionScale:12000 } }));
  assert.throws(() => validateConfig({ ...base, mapNavigation:{ resourceSelectionScale:0 } }), /zoom scale/);
  assert.throws(() => validateConfig({ ...base, mapNavigation:{ resourceSelectionScale:100000001 } }), /zoom scale/);
});
