#!/usr/bin/env node
'use strict';

// Run the same regression samples used by the live calculator.
global.window = global;
global.VD_DATA = require('../data.js');
require('../source-samples.js');
const engine = require('../engine.js');
const report = engine.selfTests(global.VD_SAMPLES);

for (const test of report.tests) {
  const mark = test.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${test.name}`);
  if (!test.ok) console.error(JSON.stringify(test.got ?? test.error ?? null, null, 2));
}

console.log(`\n${report.tests.filter(t => t.ok).length}/${report.tests.length} checks passed.`);
if (!report.ok) process.exit(1);
