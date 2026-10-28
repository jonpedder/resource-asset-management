import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResourceRenderer } from '../src/resource-symbology.js';

test('symbols use asset type and scale by available quantity', () => {
  const renderer = buildResourceRenderer([
    { attributes: { TypeClass: 'Type I', Quantity: 4 } },
    { attributes: { TypeClass: 'Type II', Quantity: 18 } },
    { attributes: { TypeClass: 'Type I', Quantity: 2 } }
  ]);

  assert.equal(renderer.type, 'uniqueValue');
  assert.equal(renderer.field1, 'TypeClass');
  assert.deepEqual(renderer.uniqueValueInfos.map(info => info.value), ['Type I', 'Type II']);
  assert.notEqual(renderer.uniqueValueInfos[0].symbol.style, renderer.uniqueValueInfos[1].symbol.style);
  assert.deepEqual(renderer.visualVariables[0], {
    type: 'sizeInfo', field: 'Quantity', minDataValue: 0, maxDataValue: 18, minSize: 7, maxSize: 30
  });
});

test('renderer remains valid when quantity or type is absent', () => {
  const renderer = buildResourceRenderer([{ attributes: { TypeClass: null, Quantity: null } }]);
  assert.equal(renderer.visualVariables[0].maxDataValue, 1);
  assert.equal(renderer.uniqueValueInfos.length, 0);
  assert.ok(renderer.defaultSymbol);
});
