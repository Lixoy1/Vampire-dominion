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
const bondCandidates = readJson('game-data/blood-bond-pairing-candidates.json');

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
run('Russian App Store release source is distinguished from the international app', () => {
  const ruStore = sources.sources.find(x => x.id === 'rustore-versions');
  const ruApple = sources.sources.find(x => x.id === 'app-store-russian');
  const intlApple = sources.sources.find(x => x.id === 'international-app-store');
  assert(Boolean(ruStore && ruApple && intlApple), 'missing one of the platform-specific version sources');
  assert(ruApple.url.includes('id6469098312'), 'Russian App Store source must use the Russian game app id');
  assert(intlApple.url.includes('id6469515429'), 'international App Store source must keep its separate app id');
  assert(!ruApple.url.includes('id6469515429'), 'international App Store listing must not be used as Russian version evidence');
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


run('Conclave aggregate reference is stored with explicit unverified status', () => {
  const ref = data.conclaveCommunityAggregate;
  assert(Boolean(ref), 'community aggregate reference missing from data.js');
  assert(ref.evidenceClass === 'community-unverified-aggregate', 'aggregate must remain unverified');
  assert(ref.useAsPerLevelFormula === false, 'aggregate must not be treated as a per-level formula');
  assert(ref.maxBranchLevel === 180, 'unexpected claimed maximum branch level');
  assert(ref.singleBranchCouncilCost === 19233610455, 'unexpected claimed single-branch cost');
  assert(ref.allFourBranchesCouncilCost === 76934441820, 'unexpected claimed all-branches cost');
  assert(ref.singleBranchAttributePerWarden === 987000, 'unexpected claimed single-branch attribute');
  assert(ref.singleBranchBookBonusPercent === 1056, 'unexpected claimed book bonus');
  assert(ref.allFourBranchesAttributePerWarden === 3948000, 'unexpected claimed four-branch attribute');
  assert(ref.allFourBranchesFor40Wardens === 157920000, 'unexpected claimed 40-Warden aggregate');
  assert(ref.gardenMaxEffectLevel === 140 && ref.gardenPointsToMax === 18900, 'Garden reference checkpoints missing');
  assert(ref.singleBranchCouncilCost * 4 === ref.allFourBranchesCouncilCost, 'branch council-cost aggregate arithmetic failed');
  assert(ref.singleBranchAttributePerWarden * 4 === ref.allFourBranchesAttributePerWarden, 'branch attribute arithmetic failed');
  assert(ref.allFourBranchesAttributePerWarden * 40 === ref.allFourBranchesFor40Wardens, '40-Warden arithmetic failed');
});
run('Conclave historical table disagreement is detected and blocks exact forecast', () => {
  const rows = data.conclaveLevels;
  const ref = data.conclaveCommunityAggregate;
  assert(rows.length === 180, 'expected 180 historical level rows');
  const direct = rows.reduce((sum, row) => sum + Number(row.dom || 0), 0);
  const book = rows.reduce((sum, row) => sum + Number(row.book || 0), 0);
  const missingCosts = rows.filter(row => row.cost === null || row.cost === undefined || !Number.isFinite(Number(row.cost)));
  assert(direct === 610200, 'historical direct attribute checkpoint unexpectedly changed; review regression impact');
  assert(book === 1092, 'historical book bonus checkpoint unexpectedly changed; review regression impact');
  assert(direct !== ref.singleBranchAttributePerWarden, 'expected unresolved direct-attribute conflict');
  assert(book !== ref.singleBranchBookBonusPercent, 'expected unresolved book-bonus conflict');
  assert(missingCosts.length === 50, 'expected known cost gaps at levels 11-20 and 141-180');
  assert(ref.useAsPerLevelFormula === false, 'community aggregate must never be used as a row-level formula');
  const conflict = conflicts.conflicts.find(row => row.id === 'conclave-full-branch-aggregate');
  assert(Boolean(conflict), 'Conclave aggregate conflict record missing');
  assert(conflict.status.includes('unresolved'), 'Conclave aggregate discrepancy must remain unresolved');
  assert(conflict.useInCalculator === false, 'unverified aggregate cannot be an approved formula');
});

run('Blood Bond candidate crosswalk covers the external 43 pair records without importing formulas', () => {
  assert(bondCandidates.source.license === null, 'unknown public repository licence must remain explicit');
  assert(bondCandidates.candidatePairs.length === 43, 'expected 43 candidate pair links');
  assert(bondCandidates.counts.byBondClass.All === 7, 'unexpected All candidate link count');
  assert(bondCandidates.counts.byBondClass.Dual === 17, 'unexpected Dual candidate link count');
  assert(bondCandidates.counts.byBondClass.Single === 19, 'unexpected Single candidate link count');
  assert(bondCandidates.localRosterCoverage.length === Object.keys(data.watchers).length, 'crosswalk roster differs from current legacy roster');
  assert(bondCandidates.localRosterCoverage.every(x => x.exactCalculationEnabled === false), 'candidate mapping must not enable exact calculations');
  const byLocalName = new Map(bondCandidates.localRosterCoverage.map(x => [x.localWardenName, x]));
  const coverageByName = new Map(coverage.wardens.map(x => [x.name, x]));
  assert(byLocalName.size === coverage.wardens.length, 'crosswalk must have exactly one row for every legacy Warden');
  for (const wardenName of Object.keys(data.watchers)) {
    const crosswalk = byLocalName.get(wardenName);
    const row = coverageByName.get(wardenName);
    assert(Boolean(crosswalk && row), 'missing crosswalk/coverage record for ' + wardenName);
    assert(JSON.stringify(row.bloodBondCandidatePairs || []) === JSON.stringify(crosswalk.publicCandidateBondPairs), 'candidate-pair IDs differ for ' + wardenName);
    assert(row.bloodBondCandidateStatus === crosswalk.coverageStatus, 'candidate-pair status differs for ' + wardenName);
  }
  assert(coverage.coverageSummary.bloodBondCandidatePairs === 43, 'coverage summary count mismatch');
  assert(coverage.coverageSummary.bloodBondMappedLocalRosterProfiles === 43, 'coverage summary mapped profile count mismatch');
  assert(coverage.coverageSummary.bloodBondUnresolvedLocalization.slice().sort().join('|') === ['Лоуренс','Чарльз'].sort().join('|'), 'explicit unresolved local aliases changed');
  assert(coverage.coverageSummary.bloodBondProbableLocalization.length === 5, 'probable localization list should remain separate from unresolved aliases');
  assert(bondCandidates.candidatePairs.every(x => x.numericTableImported === false && x.verificationStatus === 'community-candidate-unverified'), 'candidate rows must remain unverified and non-numeric');
  const unresolved = bondCandidates.candidatePairs.filter(x => x.localizationStatus === 'unresolved-localization');
  assert(unresolved.some(x => x.publicWardenName === 'Charlemagne'), 'Charlemagne localization conflict missing');
  assert(unresolved.some(x => x.publicWardenName === 'Lorenzo'), 'Lorenzo localization conflict missing');
});


const progression = readJson('game-data/community-progression-checkpoints.json');
run('Community Garden and Conclave aggregate checkpoints are recorded without entering formulas', () => {
  assert(progression.source.url === 'https://t.me/draculachest', 'unexpected community source');
  assert(progression.garden.claimedMaxEffectLevel === 140, 'Garden max-level checkpoint changed');
  assert(progression.garden.claimedTotalPointsToMax === 18900, 'Garden point-total checkpoint changed');
  assert(progression.garden.useInCalculator === false, 'unverified Garden aggregate must not enter calculations');
  const c = progression.conclave;
  assert(c.claimedMaxLevelPerBranch === 180, 'Conclave max-level checkpoint changed');
  assert(c.claimedCostPerBranch === 19233610455, 'Conclave per-branch cost checkpoint changed');
  assert(c.claimedCostAllFourBranches === 76934441820, 'Conclave four-branch cost checkpoint changed');
  assert(c.claimedAttributePerWardenPerBranch === 987000, 'Conclave per-Warden attribute checkpoint changed');
  assert(c.claimedBookBonusPercentPerBranch === 1056, 'Conclave book bonus checkpoint changed');
  assert(c.crossCheck.fourBranchesCostMatches === true && c.claimedCostPerBranch * 4 === c.claimedCostAllFourBranches, 'four-branch cost arithmetic failed');
  assert(c.crossCheck.fourBranchAttributeMatches === true && c.claimedAttributePerWardenPerBranch * 4 === c.claimedAttributePerWardenAllFourBranches, 'four-branch attribute arithmetic failed');
  assert(c.crossCheck.fortyWardenAttributeMatches === true && c.claimedAttributePerWardenAllFourBranches * 40 === c.claimedAttributeFor40WardensAllFourBranches, '40-Warden arithmetic failed');
  assert(c.useAsPerLevelFormula === false, 'aggregate must not be treated as a per-level formula');
  assert(progression.unresolvedConflicts.length >= 3, 'source conflicts must remain visible');
});

if (process.exitCode) process.exit(process.exitCode);
