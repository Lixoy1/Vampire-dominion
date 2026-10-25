#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const assets = [
  { file: 'assets/optimist-love-couple.webp.b64', label: 'Footer love illustration' },
  { file: 'assets/closeness-couple.webp.b64', label: 'Closeness illustration' }
];

for (const asset of assets) {
  const fullPath = path.join(__dirname, '..', asset.file);
  const encoded = fs.readFileSync(fullPath, 'utf8').trim();

  assert.ok(encoded.length > 1000, asset.label + ': asset looks unexpectedly small');
  assert.equal(encoded.length % 4, 0, asset.label + ': Base64 length must be divisible by four');
  assert.match(encoded, /^[A-Za-z0-9+/]+={0,2}$/, asset.label + ': contains invalid Base64 characters');

  const bytes = Buffer.from(encoded, 'base64');
  assert.equal(bytes.toString('base64'), encoded, asset.label + ': Base64 is not canonical');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', asset.label + ': missing RIFF header');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', asset.label + ': missing WebP signature');
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8, asset.label + ': RIFF size does not match file length');
  console.log('[PASS] ' + asset.label + ' (' + bytes.length.toLocaleString('en-US') + ' bytes)');
}

console.log('All illustration assets are valid.');
