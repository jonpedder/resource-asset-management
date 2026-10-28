const MUTED_AMBER = [198, 154, 75, 0.92];
const STYLES = ['circle', 'square', 'diamond', 'triangle', 'cross', 'x'];

const attributes = feature => feature?.attributes || feature || {};
const typeName = value => value == null || String(value).trim() === '' ? 'Unspecified' : String(value).trim();
const logQuantity = quantity => Math.log10(Math.max(0, quantity) + 1);

function marker(index, color = MUTED_AMBER) {
  return {
    type: 'simple-marker',
    style: STYLES[index % STYLES.length],
    color,
    size: 10,
    outline: { color: [255, 255, 255, 0.9], width: 1.25 }
  };
}

function quantityStops(maxQuantity) {
  const candidates = [0, 1, 10, 100, 1000, maxQuantity].filter(value => value <= maxQuantity || value === 0);
  const quantities = [...new Set(candidates)].sort((a, b) => a - b);
  const maximumLog = Math.max(1, logQuantity(maxQuantity));
  return quantities.map(quantity => ({
    value: quantity,
    size: quantity === 0 ? 7 : Math.round(7 + (23 * logQuantity(quantity) / maximumLog)),
    label: `${quantity.toLocaleString()} available`
  }));
}

export function buildResourceRenderer(features = []) {
  const types = [...new Set(features.map(feature => typeName(attributes(feature).TypeClass)))].sort((a, b) => a.localeCompare(b));
  const quantities = features.map(feature => Number(attributes(feature).Quantity)).filter(Number.isFinite);
  const maxQuantity = Math.max(1, ...quantities);

  return {
    type: 'unique-value',
    field: 'TypeClass',
    defaultLabel: 'Unspecified / other type',
    defaultSymbol: marker(0, [198, 154, 75, 0.78]),
    uniqueValueInfos: types.filter(type => type !== 'Unspecified').map((type, index) => ({
      value: type,
      label: type,
      symbol: marker(index)
    })),
    visualVariables: [{
      type: 'size',
      field: 'Quantity',
      legendOptions: { title: 'Quantity available (logarithmic stops)' },
      stops: quantityStops(maxQuantity)
    }]
  };
}

export function buildFacilityRenderer() {
  const buildingSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#b58bff" stroke="#fff" stroke-width="3" d="M6 24 32 8l26 16v6H6zm6 10h8v18h8V34h8v18h8V34h8v18h6v6H6v-6h6z"/></svg>`;
  return {
    type: 'simple',
    label: 'Facility',
    symbol: {
      type: 'picture-marker',
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildingSvg)}`,
      width: 24,
      height: 24
    }
  };
}

export function buildResourceQuantityLabels(minScale = 150000) {
  const configuredScale = Number(minScale);
  return [{
    labelExpressionInfo: { expression: "'Qty ' + Text(DefaultValue($feature.Quantity, 0), '#,###')" },
    labelPlacement: 'above-right',
    minScale: Number.isFinite(configuredScale) && configuredScale >= 0 ? configuredScale : 150000,
    maxScale: 0,
    deconflictionStrategy: 'static',
    symbol: {
      type: 'text',
      color: [255, 255, 255, 1],
      haloColor: [7, 20, 30, 0.92],
      haloSize: 1.5,
      xoffset: 3,
      yoffset: 1,
      font: { family: 'Arial', size: 10, weight: 'bold' }
    }
  }];
}
