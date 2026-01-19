import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('./src/data/improved_slot_filled_database.json');

// Find AAO criterion for NCT06643260
const aaoKey = Object.keys(db).find(k => db[k].cluster_code === 'AAO');
const aao = db[aaoKey];
const bsaCriterion = aao.criteria.find(c => c.nct_id === 'NCT06643260');

console.log('=== BSA Criterion ===');
console.log('raw_text:', bsaCriterion.raw_text);
console.log('Has ≥:', bsaCriterion.raw_text.includes('≥'));

// Test patterns
const rawText = bsaCriterion.raw_text;
const type = 'bsa';

// Pattern from code
const gtePattern = new RegExp(type + '[^0-9]*[≥>]+=?\\s*(\\d+(?:\\.\\d+)?)', 'i');
console.log('Pattern:', gtePattern.source);
console.log('GTE Match:', rawText.match(gtePattern));

// Find SEV criterion for NCT06643260 (PASI)
const sevKey = Object.keys(db).find(k => db[k].cluster_code === 'SEV');
const sev = db[sevKey];
const pasiCriterion = sev.criteria.find(c => c.nct_id === 'NCT06643260' && c.raw_text.includes('PASI'));

console.log('\n=== PASI Criterion ===');
console.log('raw_text:', pasiCriterion.raw_text);

const pasiPattern = new RegExp('pasi' + '[^0-9]*[≥>]+=?\\s*(\\d+(?:\\.\\d+)?)', 'i');
console.log('Pattern:', pasiPattern.source);
console.log('PASI Match:', pasiCriterion.raw_text.match(pasiPattern));

// Also test PGA
const pgaCriterion = sev.criteria.find(c => c.nct_id === 'NCT06643260' && c.raw_text.includes('PGA'));
console.log('\n=== PGA Criterion ===');
console.log('raw_text:', pgaCriterion.raw_text);

const pgaPattern = new RegExp('pga' + '[^0-9]*[≥>]+=?\\s*(\\d+(?:\\.\\d+)?)', 'i');
console.log('Pattern:', pgaPattern.source);
console.log('PGA Match:', pgaCriterion.raw_text.match(pgaPattern));
