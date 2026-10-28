const COLORS = [
  [49, 168, 255, 235],
  [62, 207, 142, 235],
  [255, 184, 61, 235],
  [197, 125, 255, 235],
  [255, 105, 120, 235],
  [52, 211, 211, 235],
  [255, 132, 66, 235],
  [145, 164, 255, 235]
];
const STYLES = ['esriSMSCircle', 'esriSMSSquare', 'esriSMSDiamond', 'esriSMSTriangle', 'esriSMSCross', 'esriSMSX'];

const attributes = feature => feature?.attributes || feature || {};
const typeName = value => value == null || String(value).trim() === '' ? 'Unspecified' : String(value).trim();

function marker(index, color = COLORS[index % COLORS.length]) {
  return {
    type: 'esriSMS',
    style: STYLES[index % STYLES.length],
    color,
    size: 10,
    outline: { type: 'esriSLS', style: 'esriSLSSolid', color: [255, 255, 255, 230], width: 1.25 }
  };
}

export function buildResourceRenderer(features = []) {
  const types = [...new Set(features.map(feature => typeName(attributes(feature).TypeClass)))].sort((a, b) => a.localeCompare(b));
  const quantities = features.map(feature => Number(attributes(feature).Quantity)).filter(Number.isFinite);
  const maxQuantity = Math.max(1, ...quantities);

  return {
    type: 'uniqueValue',
    field1: 'TypeClass',
    defaultLabel: 'Unspecified / other type',
    defaultSymbol: marker(0, [145, 155, 165, 225]),
    uniqueValueInfos: types.filter(type => type !== 'Unspecified').map((type, index) => ({
      value: type,
      label: type,
      symbol: marker(index)
    })),
    visualVariables: [{
      type: 'sizeInfo',
      field: 'Quantity',
      minDataValue: 0,
      maxDataValue: maxQuantity,
      minSize: 7,
      maxSize: 30
    }]
  };
}
