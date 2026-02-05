#!/usr/bin/env node

/**
 * compose-database.js
 *
 * Composes parsed clinical trial criteria from multiple sources into:
 *   1. Directory structure: server/data/composed/{condition_name}/{cluster_code}/criteria.json
 *   2. Unified database:   src/data/improved_slot_filled_database.json
 *
 * Input sources (priority order - higher wins on duplicate criterion IDs):
 *   1. Downloaded parser exports  (~/Downloads/clinical-trial-criteria-parsed_*.json)
 *   2. Slot-filled output files   (server/data/slot-filled-*-output.json)
 *   3. Raw cluster member files   (server/data/clusters/*.json)
 *
 * Usage:
 *   node server/compose-database.js [options]
 *
 * Options:
 *   --input <dir>       Directory to scan for parser exports (default: ~/Downloads)
 *   --condition <name>  Condition name for directory structure (default: auto-detect)
 *   --db-only           Only generate the database file, skip directory output
 *   --dry-run           Show what would be composed without writing anything
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Cluster metadata - preserved from the existing database
// ---------------------------------------------------------------------------
const CLUSTER_META = {
  AGE: { name: 'Age-Based Eligibility', question: 'How old are you?' },
  BMI: { name: 'Weight and Body Mass Index', question: 'What is your weight and height?' },
  NPV: { name: 'Non-Plaque Psoriasis Variants', question: 'What form of psoriasis do you have?' },
  CPD: {
    name: 'Chronic Plaque Psoriasis Duration Criteria',
    question: 'How long have you had psoriasis or psoriatic arthritis?',
  },
  SEV: {
    name: 'Severity Scores',
    question: 'Do you have illness severity scores in your medical records?',
  },
  AAO: { name: 'Affected Area and Organs', question: 'How much of your body is affected?' },
  AIC: {
    name: 'Active Infection History Criteria',
    question: 'Were you diagnosed with any infectious diseases?',
  },
  CMB: {
    name: 'Comorbid Conditions and Risk Factors',
    question: 'Do you have any other diseases?',
  },
  BIO: { name: 'Biomarkers', question: 'Do you have biomarker test results?' },
  FLR: { name: 'Flare History', question: 'Have you experienced disease flares?' },
  PTH: {
    name: 'Psoriasis Treatment History and Restrictions',
    question: 'Have you ever received any treatment for your disease?',
  },
  LAB: { name: 'Laboratory Values', question: 'Do you have recent lab results?' },
  ANA: { name: 'Anatomical Locations', question: 'Which body areas are affected?' },
};

// Fields to strip from parsed output (internal LLM artifacts)
const STRIP_FIELDS = ['_thought_process', 'original'];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dbOnly = args.includes('--db-only');
const inputIdx = args.indexOf('--input');
const inputDir = inputIdx !== -1 ? resolve(args[inputIdx + 1]) : join(homedir(), 'Downloads');
const conditionIdx = args.indexOf('--condition');
const conditionOverride = conditionIdx !== -1 ? args[conditionIdx + 1] : null;

const serverDataDir = join(__dirname, 'data');
const composedDir = join(serverDataDir, 'composed');
const databasePath = join(__dirname, '..', 'src', 'data', 'improved_slot_filled_database.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function globFiles(dir, pattern) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => {
      if (pattern instanceof RegExp) return pattern.test(f);
      return f.includes(pattern);
    })
    .map((f) => join(dir, f));
}

function readJSON(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`  Warning: Could not read ${filePath}: ${err.message}`);
    return null;
  }
}

function stripInternalFields(obj) {
  const cleaned = { ...obj };
  for (const field of STRIP_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}

/**
 * Normalize a criterion ID to the standard format: {CLUSTER}_{numericId}
 * Handles both "2473" / "2473.0" (from exports) and "CMB_2473" (from slot-filled)
 */
function normalizeId(rawId, clusterCode) {
  const str = String(rawId).replace(/\.0$/, ''); // strip trailing .0
  if (str.includes('_')) return str; // already prefixed
  return `${clusterCode}_${str}`;
}

/**
 * Sanitize a condition name for use as a directory name.
 * "chronic plaque psoriasis" → "chronic_plaque_psoriasis"
 */
function sanitizeDirName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------
// Source 1: Downloaded parser exports
// ---------------------------------------------------------------------------
function loadParserExports() {
  const files = globFiles(inputDir, /^clinical-trial-criteria-parsed.*\.json$/);
  const criteria = new Map();

  console.log(`\nSource 1: Parser exports from ${inputDir}`);
  console.log(`  Found ${files.length} file(s)`);

  for (const file of files) {
    const data = readJSON(file);
    if (!data?.results) continue;

    console.log(
      `  ${basename(file)}: ${data.results.length} criteria (clusters: ${Object.keys(data.clusterInfo || {}).join(', ')})`
    );

    for (const result of data.results) {
      const clusterCode = result.clusterType;
      if (!clusterCode) continue;

      const parsed = result.parsedOutput || {};
      const id = normalizeId(parsed.id || result.criterionId, clusterCode);

      const criterion = stripInternalFields({
        ...parsed,
        id,
        nct_id: parsed.nct_id || result.nctId,
        raw_text: parsed.raw_text || '',
        _source: 'parser_export',
        _sourceFile: basename(file),
        _parsedAt: result.parsedAt,
        _validationStatus: result.validationStatus,
      });

      criteria.set(id, criterion);
    }
  }

  console.log(`  Total unique criteria from exports: ${criteria.size}`);
  return criteria;
}

// ---------------------------------------------------------------------------
// Source 2: Slot-filled output files
// ---------------------------------------------------------------------------
function loadSlotFilledOutputs() {
  const files = globFiles(serverDataDir, /^slot-filled-.*-output\.json$/);
  const criteria = new Map();

  console.log(`\nSource 2: Slot-filled outputs from ${serverDataDir}`);
  console.log(`  Found ${files.length} file(s)`);

  for (const file of files) {
    const data = readJSON(file);
    if (!data?.criteria) continue;

    // Extract cluster code from the cluster field (e.g. "CLUSTER_AIC" → "AIC")
    const clusterCode = (data.cluster || '').replace('CLUSTER_', '');

    console.log(`  ${basename(file)}: ${data.criteria.length} criteria (cluster: ${clusterCode})`);

    for (const crit of data.criteria) {
      const id = normalizeId(crit.id, clusterCode);

      const criterion = stripInternalFields({
        ...crit,
        id,
        _source: 'slot_filled_output',
        _sourceFile: basename(file),
      });

      criteria.set(id, criterion);
    }
  }

  console.log(`  Total unique criteria from slot-filled: ${criteria.size}`);
  return criteria;
}

// ---------------------------------------------------------------------------
// Source 3: Raw cluster member files
// ---------------------------------------------------------------------------
function loadRawClusterFiles() {
  const clustersDir = join(serverDataDir, 'clusters');
  const files = globFiles(clustersDir, /\.json$/);
  const criteria = new Map();

  console.log(`\nSource 3: Raw cluster files from ${clustersDir}`);
  console.log(`  Found ${files.length} file(s)`);

  for (const file of files) {
    const data = readJSON(file);
    if (!data) continue;

    // These files have a "members" array (not "criteria")
    const members = data.members || data.criteria || [];
    const clusterCode = basename(file, '.json'); // e.g. "CMB"

    console.log(`  ${basename(file)}: ${members.length} members (cluster: ${clusterCode})`);

    for (const member of members) {
      const id = normalizeId(member.id, clusterCode);

      const criterion = {
        id,
        nct_id: member.nct_id,
        raw_text: member.text || member.source || '',
        EXCLUSION_STRENGTH:
          member.criterion_type === 'exclusion' ? 'mandatory_exclude' : 'inclusion',
        parsing_status: 'unparsed',
        _source: 'raw_cluster',
        _sourceFile: basename(file),
        _originalCode: member.code,
        _parsedCategory: member.parsed_category,
      };

      criteria.set(id, criterion);
    }
  }

  console.log(`  Total unique criteria from raw clusters: ${criteria.size}`);
  return criteria;
}

// ---------------------------------------------------------------------------
// Source 4: Existing database (lowest priority, preserves anything not overwritten)
// ---------------------------------------------------------------------------
function loadExistingDatabase() {
  const criteria = new Map();

  if (!existsSync(databasePath)) {
    console.log('\nSource 4: No existing database found');
    return criteria;
  }

  const data = readJSON(databasePath);
  if (!data) return criteria;

  console.log('\nSource 4: Existing database');

  for (const [key, cluster] of Object.entries(data)) {
    if (!key.startsWith('CLUSTER_') || !cluster.criteria) continue;

    const clusterCode = cluster.cluster_code;
    for (const crit of cluster.criteria) {
      const id = normalizeId(crit.id, clusterCode);
      criteria.set(id, { ...crit, id, _source: 'existing_db' });
    }
  }

  console.log(`  Total criteria in existing database: ${criteria.size}`);
  return criteria;
}

// ---------------------------------------------------------------------------
// Merge all sources (priority: exports > slot-filled > existing > raw)
// ---------------------------------------------------------------------------
function mergeCriteria() {
  const raw = loadRawClusterFiles();
  const existing = loadExistingDatabase();
  const slotFilled = loadSlotFilledOutputs();
  const exports = loadParserExports();

  // Merge: lowest priority first, highest last (overwrites)
  const merged = new Map();

  for (const [id, crit] of raw) merged.set(id, crit);
  for (const [id, crit] of existing) merged.set(id, crit);
  for (const [id, crit] of slotFilled) merged.set(id, crit);
  for (const [id, crit] of exports) merged.set(id, crit);

  console.log(`\n========================================`);
  console.log(`Total merged criteria: ${merged.size}`);

  // Count by source
  const sourceCounts = {};
  for (const crit of merged.values()) {
    const src = crit._source || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  console.log('By source:', JSON.stringify(sourceCounts, null, 2));

  return merged;
}

// ---------------------------------------------------------------------------
// Extract cluster code from criterion ID (e.g. "CMB_2473" → "CMB")
// ---------------------------------------------------------------------------
function getClusterCode(id) {
  const match = id.match(/^([A-Z]+)_/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Detect condition name from the merged criteria
// ---------------------------------------------------------------------------
function detectConditionName(merged) {
  if (conditionOverride) {
    console.log(`\nCondition name (from --condition): "${conditionOverride}"`);
    return conditionOverride;
  }

  // Look at CPD (disease duration) and NPV (psoriasis variants) criteria
  // for the primary condition. These clusters are the most indicative
  // of what disease the trials target.
  const conditionCounts = new Map();

  for (const crit of merged.values()) {
    const cluster = getClusterCode(crit.id);
    // CPD criteria contain the primary disease diagnosis
    if (cluster !== 'CPD' && cluster !== 'NPV') continue;

    const types = crit.CONDITION_TYPE || [];
    const arr = Array.isArray(types) ? types : [types];
    for (const t of arr) {
      if (!t || typeof t !== 'string') continue;
      const normalized = t.toLowerCase().trim();
      // Skip overly generic conditions
      if (normalized.length < 3) continue;
      conditionCounts.set(normalized, (conditionCounts.get(normalized) || 0) + 1);
    }
  }

  if (conditionCounts.size === 0) {
    console.log('\nCondition name: could not auto-detect, using "unknown"');
    return 'unknown';
  }

  // Pick the most frequent condition
  const sorted = [...conditionCounts.entries()].sort((a, b) => b[1] - a[1]);
  const detected = sorted[0][0];

  console.log(`\nCondition name (auto-detected): "${detected}"`);
  if (sorted.length > 1) {
    console.log(
      '  Other candidates:',
      sorted
        .slice(1, 5)
        .map(([n, c]) => `"${n}" (${c})`)
        .join(', ')
    );
  }

  return detected;
}

// ---------------------------------------------------------------------------
// Write directory structure: composed/{condition_name}/{cluster_code}/criteria.json
// ---------------------------------------------------------------------------
function writeDirectoryStructure(merged, conditionName) {
  if (dbOnly) {
    console.log('\nSkipping directory output (--db-only)');
    return;
  }

  const condDir = sanitizeDirName(conditionName);

  console.log(`\nWriting directory structure to ${composedDir}/${condDir}/`);

  // Group by cluster code (all criteria for this condition go under one tree)
  const byClusters = new Map();

  for (const crit of merged.values()) {
    const clusterCode = getClusterCode(crit.id);
    if (!clusterCode) continue;

    if (!byClusters.has(clusterCode)) byClusters.set(clusterCode, []);
    byClusters.get(clusterCode).push(crit);
  }

  let fileCount = 0;
  for (const [clusterCode, criteria] of byClusters) {
    const dir = join(composedDir, condDir, clusterCode);
    const filePath = join(dir, 'criteria.json');

    const meta = CLUSTER_META[clusterCode] || { name: clusterCode, question: '' };
    const output = {
      condition: conditionName,
      cluster_code: clusterCode,
      cluster_name: meta.name,
      primary_question: meta.question,
      criteria_count: criteria.length,
      trial_ids: [...new Set(criteria.map((c) => c.nct_id).filter(Boolean))].sort(),
      criteria: criteria.map((c) => cleanForOutput(c)),
    };

    if (dryRun) {
      console.log(
        `  ${condDir}/${clusterCode}/criteria.json  (${criteria.length} criteria from ${output.trial_ids.length} trials)`
      );
      fileCount++;
    } else {
      mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, JSON.stringify(output, null, 2));
      fileCount++;
    }
  }

  console.log(
    `  ${dryRun ? 'Would write' : 'Wrote'} ${fileCount} criteria.json files under ${condDir}/`
  );
}

// ---------------------------------------------------------------------------
// Generate improved_slot_filled_database.json
// ---------------------------------------------------------------------------
function writeDatabase(merged) {
  console.log(`\nGenerating database: ${databasePath}`);

  // Group by cluster code
  const byClusters = new Map();

  for (const crit of merged.values()) {
    const clusterCode = getClusterCode(crit.id);
    if (!clusterCode) continue;

    if (!byClusters.has(clusterCode)) byClusters.set(clusterCode, []);
    byClusters.get(clusterCode).push(crit);
  }

  // Sort clusters alphabetically
  const sortedCodes = [...byClusters.keys()].sort();

  // Build metadata
  const clusterSummaries = sortedCodes.map((code) => {
    const meta = CLUSTER_META[code] || { name: code, question: '' };
    return {
      code,
      name: meta.name,
      count: byClusters.get(code).length,
      primary_question: meta.question,
    };
  });

  const totalCriteria = sortedCodes.reduce((sum, code) => sum + byClusters.get(code).length, 0);

  const database = {
    metadata: {
      project: 'Clinical Trial Eligibility Questionnaire',
      version: '2.0_improved',
      created_date: '2026-01-10',
      last_updated: new Date().toISOString().split('T')[0],
      total_criteria: totalCriteria,
      total_clusters: sortedCodes.length,
      clusters: clusterSummaries,
    },
  };

  // Build CLUSTER_* entries
  for (const code of sortedCodes) {
    const criteria = byClusters.get(code);
    const meta = CLUSTER_META[code] || { name: code, question: '' };

    database[`CLUSTER_${code}`] = {
      cluster_name: meta.name,
      cluster_code: code,
      total_criteria: criteria.length,
      primary_question: meta.question,
      answer_type: 'autocomplete',
      criteria: criteria.map((c) => cleanForOutput(c)),
    };
  }

  if (dryRun) {
    console.log(
      `  Would write database with ${totalCriteria} criteria across ${sortedCodes.length} clusters`
    );
    for (const code of sortedCodes) {
      console.log(`    CLUSTER_${code}: ${byClusters.get(code).length} criteria`);
    }
  } else {
    writeFileSync(databasePath, JSON.stringify(database, null, 2));
    console.log(
      `  Wrote database with ${totalCriteria} criteria across ${sortedCodes.length} clusters`
    );
  }
}

// ---------------------------------------------------------------------------
// Clean criterion for output (strip internal _source fields)
// ---------------------------------------------------------------------------
function cleanForOutput(criterion) {
  const cleaned = { ...criterion };
  delete cleaned._source;
  delete cleaned._sourceFile;
  delete cleaned._parsedAt;
  delete cleaned._validationStatus;
  delete cleaned._originalCode;
  delete cleaned._parsedCategory;
  return cleaned;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('========================================');
  console.log('  Clinical Trial Criteria Composer');
  console.log('========================================');
  if (dryRun) console.log('  (DRY RUN - no files will be written)');

  const merged = mergeCriteria();
  const conditionName = detectConditionName(merged);

  writeDirectoryStructure(merged, conditionName);
  writeDatabase(merged);

  console.log('\n========================================');
  console.log('  Done!');
  console.log('========================================');
}

main();
