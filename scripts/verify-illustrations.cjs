#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const assets = [
  { label: 'Footer love illustration', path: 'assets/optimist-love.webp', minBytes: 5000 },
  { label: 'Closeness illustration', path: 'assets/closeness.webp', minBytes: 3000 },
  { label: 'Header vampire illustration', path: 'assets/optimist-vampire-clean.webp', minBytes: 50000 }
];

for (const asset of assets) {
  const filename = path.join(__dirname, '..', asset.path);
  assert.ok(fs.existsSync(filename), asset.label + ': file is missing');
  const bytes = fs.readFileSync(filename);
  assert.ok(bytes.length >= asset.minBytes, asset.label + ': file looks unexpectedly small');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', asset.label + ': missing RIFF header');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', asset.label + ': missing WebP signature');
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8, asset.label + ': RIFF size does not match file length');
  console.log('[PASS] ' + asset.label + ' (' + bytes.length.toLocaleString('en-US') + ' bytes)');
}

console.log('All optimized WebP illustration assets are valid.');
