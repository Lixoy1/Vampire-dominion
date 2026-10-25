#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const data = require('../data.js');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function run(name, fn) {
  try { fn(); console.log('[PASS] ' + name); }
  catch (error) { console.error('[FAIL] ' + name + ': ' + error.message); process.exitCode = 1; }
}

const coverage = readJson('game-data/catalog-coverage.json');
const bonds = readJson('game-data/blood-bonds-observations.json');
const garden = readJson('game-data/garden-observations.json');
const sources = readJson('game-data/source-manifest.json');
const conflicts = readJson('game-data/source-conflicts.json');

run('Coverage roster exactly matches current legacy data.js roster', () => {
  const expected = Object.keys(data.watchers).sort();
  const actual = coverage.wardens.map(x => x.name).sort();
  assert(new Set(actual).size === actual.length, 'duplicate Warden names in coverage');
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'coverage roster differs from data.js');
  assert(coverage.legacyRosterSource.wardenCount === expected.length, 'wrong legacy roster count');
});
run('Legacy Warden profiles contain no placeholder and have normalized talent rows', () => {
  assert(!Object.prototype.hasOwnProperty.call(data.watchers, 'новый'), 'temporary placeholder must not be selectable');
  const allowed = new Set(['Сила', 'Харизма', 'Интеллект', 'Воля']);
  const invalid = [];
  for (const [name, rows] of Object.entries(data.watchers)) {
    for (const row of rows) {
      if (!allowed.has(row.attr) || !Number.isInteger(Number(row.star)) || Number(row.star) < 1 || Number(row.star) > 6) {
        invalid.push({ name, attr: row.attr, star: row.star });
      }
    }
  }
  assert(invalid.length === 0, 'invalid talent rows: ' + JSON.stringify(invalid.slice(0, 10)));
  assert(data.watcherDataStatus && data.watcherDataStatus['Мара'] && data.watcherDataStatus['Мара'].status === 'incomplete', 'Mara incomplete profile must be marked explicitly');
  assert(coverage.coverageSummary.profilesBlockedFromExactForecast.includes('Мара'), 'coverage registry must block Mara exact forecast');
});
run('Blood Bonds observations are explicitly non-calculating', () => {
  assert(bonds.observations.length > 0, 'no observations registered');
  const seen = new Set();
  for (const row of bonds.observations) {
    assert(row.warden && row.skillName && row.level > 0, 'missing identity or level');
    assert(row.nextLevel === row.level + 1, 'non-consecutive observed level');
    assert(row.upgradeCostDisplayed, 'missing displayed cost');
    assert(row.dominionGain === null, 'unverified Dominion gain must remain null');
    assert(row.status === 'observation-only', 'observations must not be treated as a complete formula');
    const key = row.warden + '|' + row.skillName + '|' + row.level;
    assert(!seen.has(key), 'duplicate observation ' + key);
    seen.add(key);
  }
});
run('Garden observations preserve raw evidence and block unverified aggregate from calculator', () => {
  const levels = garden.observations.map(x => x.level);
  assert(JSON.stringify(levels) === JSON.stringify([109, 110, 111, 112, 113, 114, 115]), 'unexpected Garden level list');
  for (const row of garden.observations) {
    assert(row.dominanceGain === null, 'unverified Garden Dominion gain must remain null');
    assert(row.bonuses.length > 0, 'Garden observation without a visible effect');
  }
  assert(garden.communityAggregate.useInCalculator === false, 'community aggregate must not be a formula constant');
  assert(garden.communityAggregate.evidenceClass === 'community-unverified', 'aggregate evidence status must be explicit');
});
run('Source manifest marks the requested unidentified channel as unresolved', () => {
  const source = sources.sources.find(x => x.id === 'dampirlogiya');
  assert(Boolean(source), 'missing Dampirlogiya tracking entry');
  assert(source.url === null, 'do not invent a source URL');
  assert(source.status.includes('not identified'), 'unidentified source status missing');
});

run('External dataset conflicts remain explicit and cannot become formula constants', () => {
  assert(conflicts.sources.publicFanRepo.license === null, 'unknown license must stay explicit');
  assert(conflicts.conflicts.length >= 4, 'expected cross-source conflict register');
  for (const row of conflicts.conflicts) {
    assert(row.id && row.system && row.status, 'conflict row missing identity/status');
    assert(row.status.startsWith('unresolved') || row.status.includes('unresolved') || row.status.startsWith('known-dataset-disagreement') || row.status.startsWith('coverage-and-name-mapping'), 'conflict must remain explicitly unresolved: ' + row.id);
  }
  const repository = sources.sources.find(x => x.id === 'public-fan-calculator-repository');
  assert(Boolean(repository), 'missing public fan repository in source manifest');
  assert(repository.metadata && repository.metadata.license === null, 'public repository licence metadata must remain explicit');
  assert(repository.metadata.lastObservedPushAt === '2026-06-11T03:05:42Z', 'unexpected candidate source date');
});

run('Conclave aggregate mismatch is registered and excluded from calculations', () => {
  const row = conflicts.conflicts.find(x => x.id === 'conclave-full-branch-aggregate');
  assert(Boolean(row), 'missing Conclave aggregate conflict');
  assert(row.status === 'unresolved-aggregate-disagreement', 'Conclave aggregate must remain unresolved');
  assert(row.useInCalculator === false, 'unresolved Conclave aggregate must not be used by the calculator');
  assert(row.communityClaim.fullBranchDominionPerWarden === 987000, 'community Dominion claim changed unexpectedly');
  assert(row.communityClaim.fullBranchBookBonusPercent === 1056, 'community book-bonus claim changed unexpectedly');
  assert(row.communityClaim.fullBranchCouncilCost === 19233610455, 'community cost claim changed unexpectedly');
  assert(row.localCandidate.cumulativeDominionPerBranch === 610200, 'legacy Conclave aggregate must be recalculated/reviewed');
  assert(row.localCandidate.cumulativeBookBonusPercent === 1092, 'legacy book bonus aggregate must be recalculated/reviewed');
  assert(row.localCandidate.costUnknownCount === 50, 'unknown Conclave cost coverage changed; review source data');
});
run('Garden 18,900 subtotal is stored as a cross-check only', () => {
  const row = (conflicts.crossChecks || []).find(x => x.id === 'garden-cost-subtotal-1-140');
  assert(Boolean(row), 'missing Garden subtotal cross-check');
  assert(row.derivedFromPublicTable.sumCost === 18900, 'candidate Garden cost subtotal no longer matches cited figure');
  assert(row.useInCalculator === false, 'cross-source arithmetic must not be treated as game verification');
});

if (process.exitCode) process.exit(process.exitCode);
