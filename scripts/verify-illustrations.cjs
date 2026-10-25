#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const assets = [
  {
    label: 'Footer love illustration (160 × 240)',
    parts: [
      'assets/love-hq-00.b64',
      'assets/love-hq-01.b64',
      'assets/love-hq-02.b64',
      'assets/love-hq-03.b64',
      'assets/love-hq-04.b64',
      'assets/love-hq-05.b64'
    ],
    expectedBytes: 8642
  },
  {
    label: 'Closeness illustration (160 × 192)',
    parts: [
      'assets/closeness-hq-00.b64',
      'assets/closeness-hq-01.b64',
      'assets/closeness-hq-02.b64',
      'assets/closeness-hq-03.b64',
      'assets/closeness-hq-04.b64'
    ],
    expectedBytes: 8096
  }
];

for (const asset of assets) {
  const encoded = asset.parts
    .map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').trim())
    .join('');

  assert.ok(encoded.length > 1000, asset.label + ': asset looks unexpectedly small');
  assert.equal(encoded.length % 4, 0, asset.label + ': Base64 length must be divisible by four');
  assert.match(encoded, /^[A-Za-z0-9+/]+={0,2}$/, asset.label + ': contains invalid Base64 characters');

  const bytes = Buffer.from(encoded, 'base64');
  assert.equal(bytes.toString('base64'), encoded, asset.label + ': Base64 is not canonical');
  assert.equal(bytes.length, asset.expectedBytes, asset.label + ': unexpected image byte length');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', asset.label + ': missing RIFF header');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', asset.label + ': missing WebP signature');
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8, asset.label + ': RIFF size does not match file length');

  console.log('[PASS] ' + asset.label + ' (' + bytes.length.toLocaleString('en-US') + ' bytes)');
}

console.log('All high-quality illustration assets are valid.');
