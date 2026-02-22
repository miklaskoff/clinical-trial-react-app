import fs from 'fs';
const data = JSON.parse(fs.readFileSync('./data/slot-filled-cmb-clean.json', 'utf-8'));

const c = data.criteria.filter(x => x.parsing_status !== 'error');

console.log('=== CONSISTENCY CHECK REPORT ===\n');

// 1. SEVERITY vs CONDITION_PATTERN for active/acute/chronic
console.log('--- 1. ACTIVE/ACUTE/CHRONIC placement ---');
console.log('Rule: "active" -> CONDITION_PATTERN, "acute/chronic" -> SEVERITY\n');

let severityIssues = [];
c.forEach(x => {
  const raw = (x.raw_text || '').toLowerCase();
  const hasActive = raw.includes('active');
  const hasAcute = raw.includes('acute');
  const hasChronic = raw.includes('chronic');
  
  if (hasActive || hasAcute || hasChronic) {
    const activeInPattern = x.CONDITION_PATTERN?.includes('active');
    const acuteInSeverity = x.SEVERITY?.includes('acute');
    const chronicInSeverity = x.SEVERITY?.includes('chronic');
    
    let issues = [];
    if (hasActive && !activeInPattern) issues.push('"active" not in PATTERN');
    if (hasAcute && !acuteInSeverity) issues.push('"acute" not in SEVERITY');
    if (hasChronic && !chronicInSeverity) issues.push('"chronic" not in SEVERITY');
    
    if (issues.length > 0) {
      severityIssues.push({ id: x.id, issues, raw: raw.substring(0, 80) });
    }
    
    console.log(issues.length === 0 ? 'OK' : '!!', x.id);
    console.log('   SEVERITY:', JSON.stringify(x.SEVERITY));
    console.log('   PATTERN:', JSON.stringify(x.CONDITION_PATTERN));
    if (issues.length > 0) console.log('   ISSUES:', issues.join(', '));
  }
});

// 2. Check "with" keyword - should it be AND?
console.log('\n--- 2. "WITH" keyword handling ---');
c.forEach(x => {
  const raw = (x.raw_text || '').toLowerCase();
  if (raw.includes(' with ') && !raw.includes('within')) {
    const op = x.LOGICAL_OPERATOR;
    console.log(op === 'AND' ? 'OK' : '??', x.id, 'OP=' + op);
    console.log('   ', raw.substring(0, 80));
  }
});

// 3. Check NESTED_CONDITION consistency
console.log('\n--- 3. NESTED_CONDITION structure ---');
const nestedStructures = [];
c.forEach(x => {
  if (x.NESTED_CONDITION) {
    nestedStructures.push({
      id: x.id,
      hasMainCondition: !!x.NESTED_CONDITION.main_condition,
      hasNestedOperator: !!x.NESTED_CONDITION.nested_operator,
      hasNestedItems: !!x.NESTED_CONDITION.nested_items,
      operator: x.NESTED_CONDITION.nested_operator
    });
  }
});
console.log('Criteria with NESTED_CONDITION:', nestedStructures.length);
const operators = {};
nestedStructures.forEach(n => {
  operators[n.operator] = (operators[n.operator] || 0) + 1;
});
console.log('Nested operators used:', operators);

// 4. Check unfamiliar_term_flag consistency
console.log('\n--- 4. unfamiliar_term_flag vs parsing_status ---');
let flagMismatches = [];
c.forEach(x => {
  const hasFlagTrue = x.unfamiliar_term_flag === true;
  const isPending = x.parsing_status === 'pending_admin_review';
  
  if (hasFlagTrue && !isPending) {
    flagMismatches.push({ id: x.id, flag: hasFlagTrue, status: x.parsing_status });
  }
});
console.log('Criteria with unfamiliar_term_flag=true but NOT pending:', flagMismatches.length);
if (flagMismatches.length > 0) {
  flagMismatches.forEach(m => console.log('  !!', m.id, 'flag=true but status=' + m.status));
}

// 5. Check confidence thresholds
console.log('\n--- 5. CONFIDENCE distribution ---');
const confBuckets = { 'below_0.7': 0, '0.7-0.8': 0, '0.8-0.9': 0, '0.9-1.0': 0, 'exactly_1.0': 0 };
c.forEach(x => {
  const conf = x.confidence || 0;
  if (conf < 0.7) confBuckets['below_0.7']++;
  else if (conf < 0.8) confBuckets['0.7-0.8']++;
  else if (conf < 0.9) confBuckets['0.8-0.9']++;
  else if (conf < 1.0) confBuckets['0.9-1.0']++;
  else confBuckets['exactly_1.0']++;
});
console.log(confBuckets);

// 6. Check REQUIRES_CLINICAL_JUDGMENT consistency
console.log('\n--- 6. REQUIRES_CLINICAL_JUDGMENT patterns ---');
const judgmentPhrases = ['clinically significant', 'investigator', 'opinion', 'judgment', 'could interfere'];
c.forEach(x => {
  const raw = (x.raw_text || '').toLowerCase();
  const hasSubjectivePhrase = judgmentPhrases.some(p => raw.includes(p));
  const flaggedAsJudgment = x.REQUIRES_CLINICAL_JUDGMENT === true;
  
  if (hasSubjectivePhrase !== flaggedAsJudgment) {
    console.log('MISMATCH', x.id);
    console.log('   raw:', raw.substring(0, 80));
    console.log('   hasSubjective:', hasSubjectivePhrase, 'flagged:', flaggedAsJudgment);
  }
});

// 7. Summary
console.log('\n=== SUMMARY ===');
console.log('Total criteria checked:', c.length);
console.log('EXCLUSION_STRENGTH distribution:');
const str = {};
c.forEach(x => { str[x.EXCLUSION_STRENGTH || 'undefined'] = (str[x.EXCLUSION_STRENGTH || 'undefined'] || 0) + 1; });
console.log(str);
console.log('CRITERION_TYPE distribution:');
const typ = {};
c.forEach(x => { typ[x.CRITERION_TYPE || 'undefined'] = (typ[x.CRITERION_TYPE || 'undefined'] || 0) + 1; });
console.log(typ);
