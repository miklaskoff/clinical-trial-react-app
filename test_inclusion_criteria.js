/**
 * Test script for verifying inclusion criteria logic
 * Run with: node test_inclusion_criteria.js
 */

const SLOT_FILLED_DATABASE = require('./src/improved_slot_filled_database.json');

console.log('=== INCLUSION CRITERIA TEST ===\n');

// Check if database has inclusion criteria
let totalCriteria = 0;
let inclusionCount = 0;
let exclusionCount = 0;

Object.keys(SLOT_FILLED_DATABASE).forEach(key => {
  if (key.startsWith('CLUSTER_')) {
    const cluster = SLOT_FILLED_DATABASE[key];
    if (cluster.criteria) {
      cluster.criteria.forEach(criterion => {
        totalCriteria++;
        if (criterion.EXCLUSION_STRENGTH === 'inclusion') {
          inclusionCount++;
        } else {
          exclusionCount++;
        }
      });
    }
  }
});

console.log(`📊 Database Statistics:`);
console.log(`   Total Criteria: ${totalCriteria}`);
console.log(`   Inclusion Criteria: ${inclusionCount} (${(inclusionCount/totalCriteria*100).toFixed(1)}%)`);
console.log(`   Exclusion Criteria: ${exclusionCount} (${(exclusionCount/totalCriteria*100).toFixed(1)}%)`);
console.log();

// Check specific fixed criteria
console.log('📋 Checking Fixed Criteria:\n');

// Check AGE_2365
const ageCluster = SLOT_FILLED_DATABASE.CLUSTER_AGE;
const age2365 = ageCluster.criteria.find(c => c.id === 'AGE_2365');
if (age2365) {
  console.log('✅ AGE_2365 found:');
  console.log(`   AGE_MIN: ${age2365.AGE_MIN} (expected: 6)`);
  console.log(`   AGE_MAX: ${age2365.AGE_MAX} (expected: 17)`);
  console.log(`   EXCLUSION_STRENGTH: ${age2365.EXCLUSION_STRENGTH}`);
  console.log(`   Status: ${age2365.AGE_MIN === 6 && age2365.AGE_MAX === 17 ? '✅ CORRECT' : '❌ INCORRECT'}`);
} else {
  console.log('❌ AGE_2365 not found');
}
console.log();

// Check BMI_2366
const bmiCluster = SLOT_FILLED_DATABASE.CLUSTER_BMI;
const bmi2366 = bmiCluster.criteria.find(c => c.id === 'BMI_2366');
if (bmi2366) {
  console.log('✅ BMI_2366 found:');
  console.log(`   WEIGHT_MIN: ${bmi2366.WEIGHT_MIN} (expected: 15)`);
  console.log(`   WEIGHT_UNIT: ${bmi2366.WEIGHT_UNIT} (expected: kg)`);
  console.log(`   EXCLUSION_STRENGTH: ${bmi2366.EXCLUSION_STRENGTH}`);
  console.log(`   Status: ${bmi2366.WEIGHT_MIN === 15 && bmi2366.WEIGHT_UNIT === 'kg' ? '✅ CORRECT' : '❌ INCORRECT'}`);
} else {
  console.log('❌ BMI_2366 not found');
}
console.log();

// Find a trial with both inclusion and exclusion criteria
console.log('🔍 Finding trials with mixed inclusion/exclusion criteria:\n');

const trialCriteria = {};
Object.keys(SLOT_FILLED_DATABASE).forEach(key => {
  if (key.startsWith('CLUSTER_')) {
    const cluster = SLOT_FILLED_DATABASE[key];
    if (cluster.criteria) {
      cluster.criteria.forEach(criterion => {
        const nctId = criterion.nct_id;
        if (!trialCriteria[nctId]) {
          trialCriteria[nctId] = { inclusions: 0, exclusions: 0 };
        }
        if (criterion.EXCLUSION_STRENGTH === 'inclusion') {
          trialCriteria[nctId].inclusions++;
        } else {
          trialCriteria[nctId].exclusions++;
        }
      });
    }
  }
});

const mixedTrials = Object.entries(trialCriteria)
  .filter(([nctId, counts]) => counts.inclusions > 0 && counts.exclusions > 0)
  .slice(0, 5);

if (mixedTrials.length > 0) {
  console.log(`Found ${Object.keys(trialCriteria).length} total trials`);
  console.log(`Found ${mixedTrials.length} trials with both inclusion and exclusion criteria:\n`);
  mixedTrials.forEach(([nctId, counts]) => {
    console.log(`   ${nctId}: ${counts.inclusions} inclusions, ${counts.exclusions} exclusions`);
  });
} else {
  console.log('❌ No trials found with both inclusion and exclusion criteria');
}
console.log();

// Sample inclusion criteria from different clusters
console.log('📝 Sample Inclusion Criteria by Cluster:\n');

Object.keys(SLOT_FILLED_DATABASE).forEach(key => {
  if (key.startsWith('CLUSTER_')) {
    const cluster = SLOT_FILLED_DATABASE[key];
    const inclusionExample = cluster.criteria.find(c => c.EXCLUSION_STRENGTH === 'inclusion');
    if (inclusionExample) {
      console.log(`${cluster.cluster_code}:`);
      console.log(`   ID: ${inclusionExample.id}`);
      console.log(`   NCT: ${inclusionExample.nct_id}`);
      console.log(`   Raw: ${inclusionExample.raw_text.substring(0, 80)}...`);
      console.log();
    }
  }
});

console.log('✅ Test completed!\n');
console.log('Next steps:');
console.log('1. Start the app: npm start');
console.log('2. Fill questionnaire with data matching inclusion criteria');
console.log('3. Verify patient is marked as ELIGIBLE for matching trials');
console.log('4. Fill questionnaire with data NOT matching inclusion criteria');
console.log('5. Verify patient is marked as INELIGIBLE');
