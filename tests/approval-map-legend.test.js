import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../src/approval.js',import.meta.url),'utf8');

test('movement map legend explains outbound and return arrow directions',()=>{
  assert.match(source,/Outbound: origin → destination/);
  assert.match(source,/Return: destination → origin/);
  assert.match(source,/Planned outbound: origin → destination/);
  assert.match(source,/title:'Movement direction \(follow arrows\)'/);
});
