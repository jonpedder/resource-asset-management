import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResourceQuantityLabels, buildResourceRenderer } from '../src/resource-symbology.js';

test('symbols use asset type and logarithmic available-quantity sizes', () => {
  const renderer = buildResourceRenderer([
    { attributes: { TypeClass: 'Type I', Quantity: 4 } },
    { attributes: { TypeClass: 'Type II', Quantity: 10000 } },
    { attributes: { TypeClass: 'Type I', Quantity: 2 } }
  ]);

  assert.equal(renderer.type, 'unique-value');
  assert.equal(renderer.field, 'TypeClass');
  assert.deepEqual(renderer.uniqueValueInfos.map(info => info.value), ['Type I', 'Type II']);
  assert.notEqual(renderer.uniqueValueInfos[0].symbol.style, renderer.uniqueValueInfos[1].symbol.style);
  const size = renderer.visualVariables[0];
  assert.equal(size.type, 'size');
  assert.match(size.valueExpression, /Log10/);
  assert.match(size.valueExpressionTitle, /logarithmic/i);
  assert.equal(size.stops.at(-1).label, '10,000 available');
  assert.equal(size.stops.at(-1).size, 30);
});

test('quantity labels appear beside symbols only at operational scales', () => {
  const [label] = buildResourceQuantityLabels();
  assert.match(label.labelExpressionInfo.expression, /Qty/);
  assert.equal(label.labelPlacement, 'above-right');
  assert.equal(label.minScale, 150000);
  assert.equal(label.deconflictionStrategy, 'static');
  assert.equal(buildResourceQuantityLabels(75000)[0].minScale, 75000);
});

test('renderer remains valid when quantity or type is absent', () => {
  const renderer = buildResourceRenderer([{ attributes: { TypeClass: null, Quantity: null } }]);
  assert.equal(renderer.visualVariables[0].stops.at(-1).label, '1 available');
  assert.equal(renderer.uniqueValueInfos.length, 0);
  assert.ok(renderer.defaultSymbol);
});
