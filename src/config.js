export const CONFIG_OVERRIDE_KEY = 'ram-config-overrides-v2';

function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function merge(base, overrides) {
  return {
    ...base, ...overrides,
    layers: { ...object(base.layers), ...object(overrides.layers) },
    branding: {
      ...object(base.branding), ...object(overrides.branding),
      colors: { ...object(base.branding?.colors), ...object(overrides.branding?.colors) }
    },
    labels: { ...object(base.labels), ...object(overrides.labels) },
    statusColors: { ...object(base.statusColors), ...object(overrides.statusColors) },
    layerVisibility: { ...object(base.layerVisibility), ...object(overrides.layerVisibility) },
    mapNavigation: { ...object(base.mapNavigation), ...object(overrides.mapNavigation) },
    workflow: { ...object(base.workflow), ...object(overrides.workflow) }
  };
}

export function readConfigOverrides() {
  try { return object(JSON.parse(localStorage.getItem(CONFIG_OVERRIDE_KEY) || '{}')); }
  catch { return {}; }
}

export function saveConfigOverrides(value) { localStorage.setItem(CONFIG_OVERRIDE_KEY, JSON.stringify(object(value))); }
export function clearConfigOverrides() { localStorage.removeItem(CONFIG_OVERRIDE_KEY); }

export async function loadConfig(url = './app-config.json') {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Configuration could not be loaded (${response.status}).`);
  const config = merge(await response.json(), readConfigOverrides());
  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  const required = ['portalUrl', 'featureServiceUrl', 'webmapId', 'workflow'];
  for (const key of required) if (!config?.[key]) throw new Error(`Missing configuration value: ${key}`);
  if (!/^https:\/\//i.test(config.portalUrl) || !/^https:\/\//i.test(config.featureServiceUrl)) throw new Error('Portal and feature service URLs must use HTTPS.');
  const selectionScale=Number(config.mapNavigation?.resourceSelectionScale??24000);
  if (!Number.isFinite(selectionScale) || selectionScale < 100 || selectionScale > 100000000) throw new Error('Resource selection zoom scale must be between 100 and 100,000,000.');
  if (config.layers) {
    for (const name of ['resources','facilities','requests','movements']) if (!Number.isInteger(Number(config.layers[name]))) throw new Error(`Missing or invalid layer id: ${name}`);
    const layerIds=['resources','facilities','requests','movements'].map(name=>Number(config.layers[name]));
    if (new Set(layerIds).size !== layerIds.length) throw new Error('Configured resource, facility, request, and movement layer ids must be unique.');
  }
  return config;
}
