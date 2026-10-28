const COLOR_VARS = Object.freeze({
  navy: '--app-navy', background: '--app-bg', panel: '--app-panel', panelAlt: '--app-panel-2',
  accent: '--app-accent', text: '--app-text', muted: '--app-muted', border: '--app-border'
});
const STATUS_VARS = Object.freeze({ Available: '--status-available', Committed: '--status-committed', 'En Route': '--status-enroute', 'Out of Service': '--status-out', Demobilized: '--status-demobilized' });

export function applyPresentation(config, root = document) {
  const branding = config.branding || {}; const labels = config.labels || {}; const style = root.documentElement.style;
  for (const [key, variable] of Object.entries(COLOR_VARS)) if (/^#[0-9a-f]{6}$/i.test(branding.colors?.[key] || '')) style.setProperty(variable, branding.colors[key]);
  for (const [key, variable] of Object.entries(STATUS_VARS)) if (/^#[0-9a-f]{6}$/i.test(config.statusColors?.[key] || '')) style.setProperty(variable, config.statusColors[key]);
  root.querySelectorAll('[data-brand-name]').forEach(node => node.textContent = branding.appName || 'Resource & Asset Management');
  root.querySelectorAll('[data-brand-subtitle]').forEach(node => node.textContent = branding.subtitle || 'FEMA NIMS Common Operating Picture');
  root.querySelectorAll('[data-brand-logo]').forEach(node => { node.hidden = !branding.logoUrl; if (branding.logoUrl) node.src = branding.logoUrl; });
  const text = { resourceInventoryHeading: labels.inventoryHeading, filterHeading: labels.filtersHeading };
  for (const [id, value] of Object.entries(text)) if (value && root.getElementById(id)) root.getElementById(id).textContent = value;
  if (branding.appName) root.title = `${root.title.split('|')[0].trim()} | ${branding.appName}`;
}
