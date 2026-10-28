import { readFile } from 'node:fs/promises';

const path = new URL('../../app-config.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
const serialized = JSON.stringify(config);
const placeholders = ['NEW_', 'YOUR_ORG'];
const found = placeholders.filter(value => serialized.includes(value));
if (found.length) throw new Error(`Configuration still contains placeholders: ${found.join(', ')}`);
console.log('Configuration contains no scaffold placeholders.');
