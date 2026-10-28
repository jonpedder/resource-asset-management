const COLORS = [
  [49, 168, 255, 0.92],
  [62, 207, 142, 0.92],
  [255, 184, 61, 0.92],
  [197, 125, 255, 0.92],
  [255, 105, 120, 0.92],
  [52, 211, 211, 0.92],
  [255, 132, 66, 0.92],
  [145, 164, 255, 0.92]
];
const STYLES = ['circle', 'square', 'diamond', 'triangle', 'cross', 'x'];

const attributes = feature => feature?.attributes || feature || {};
const typeName = value => value == null || String(value).trim() === '' ? 'Unspecified' : String(value).trim();
const logQuantity = quantity => Math.log10(Math.max(0, quantity) + 1);

function marker(index, color = COLORS[index % COLORS.length]) {
  return {
    type: 'simple-marker',
    style: STYLES[index % STYLES.length],
    color,
    size: 10,
    outline: { color: [255, 255, 255, 0.9], width: 1.25 }
  };
}

function quantityStops(maxQuantity) {
  const middleQuantity = Math.max(1, Math.round(Math.sqrt(maxQuantity)));
  return [
    { value: 0, size: 7, label: '0 available' },
    { value: logQuantity(1), size: 10, label: '1 available' },
    { value: logQuantity(middleQuantity), size: 19, label: `${middleQuantity.toLocaleString()} available` },
    { value: logQuantity(maxQuantity), size: 30, label: `${maxQuantity.toLocaleString()} available` }
  ].filter((stop, index, stops) => index === 0 || stop.value > stops[index - 1].value);
}

export function buildResourceRenderer(features = []) {
  const types = [...new Set(features.map(feature => typeName(attributes(feature).TypeClass)))].sort((a, b) => a.localeCompare(b));
  const quantities = features.map(feature => Number(attributes(feature).Quantity)).filter(Number.isFinite);
  const maxQuantity = Math.max(1, ...quantities);

  return {
    type: 'unique-value',
    field: 'TypeClass',
    defaultLabel: 'Unspecified / other type',
    defaultSymbol: marker(0, [145, 155, 165, 0.88]),
    uniqueValueInfos: types.filter(type => type !== 'Unspecified').map((type, index) => ({
      value: type,
      label: type,
      symbol: marker(index)
    })),
    visualVariables: [{
      type: 'size',
      valueExpression: 'Log10(Max(0, DefaultValue($feature.Quantity, 0)) + 1)',
      valueExpressionTitle: 'Symbol size: quantity available (logarithmic)',
      stops: quantityStops(maxQuantity)
    }]
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
