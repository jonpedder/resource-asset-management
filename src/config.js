export async function loadConfig(url = './app-config.json') {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Configuration could not be loaded (${response.status}).`);
  const config = await response.json();
  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  const required = ['portalUrl', 'oauthClientId', 'featureServiceUrl', 'webmapId', 'workflow'];
  for (const key of required) if (!config?.[key]) throw new Error(`Missing configuration value: ${key}`);
  return config;
}
