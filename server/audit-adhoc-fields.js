/**
 * Audit script to find ALL ad-hoc fields in parsed output
 * These are fields/values created by LLM that are NOT defined in schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load schema
const schema = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'config/output-schemas.json'), 
  'utf8'
));

// Get all defined field names from schema
const definedFields = new Set([
  ...schema.commonFields.required,
  ...schema.commonFields.optional,
  ...Object.keys(schema.fieldTypes)
]);

console.log('=== DEFINED TOP-LEVEL FIELDS IN SCHEMA ===');
console.log([...definedFields].sort().join('\n'));
console.log('\n');

// Audit results
const auditResults = {
  nestedItemTypes: new Set(),
  nestedItemFields: new Set(),
  treatmentHistoryFields: new Set(),
  timeframeFields: new Set(),
  exceptionConditionFields: new Set(),
  negationDetectedFields: new Set(),
  unknownTopLevelFields: new Set(),
  mainConditionFields: new Set(),
  requirementsFields: new Set()
};

// Find all JSON files in data folder
const dataDir = path.join(__dirname, 'data');
const jsonFiles = fs.readdirSync(dataDir)
  .filter(f => f.startsWith('slot-filled-') && f.endsWith('.json'));

console.log('=== SCANNING FILES ===');
console.log(jsonFiles.join('\n'));
console.log('\n');

for (const file of jsonFiles) {
  const filePath = path.join(dataDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.log(`Skipping ${file} - parse error: ${e.message}`);
    continue;
  }
  
  console.log(`Processing ${file}: ${data.criteria?.length || 0} criteria`);
  
  for (const criterion of (data.criteria || [])) {
    // Check top-level fields
    for (const key of Object.keys(criterion)) {
      if (!definedFields.has(key) && !key.startsWith('_')) {
        auditResults.unknownTopLevelFields.add(key);
      }
    }
    
    // Check NESTED_CONDITION structure
    if (criterion.NESTED_CONDITION) {
      const nc = criterion.NESTED_CONDITION;
      
      // main_condition fields
      if (nc.main_condition) {
        Object.keys(nc.main_condition).forEach(k => 
          auditResults.mainConditionFields.add(k)
        );
      }
      
      // nested_items
      if (nc.nested_items) {
        for (const item of nc.nested_items) {
          if (item.type) {
            auditResults.nestedItemTypes.add(item.type);
          }
          Object.keys(item).forEach(k => 
            auditResults.nestedItemFields.add(k)
          );
          
          // requirements subfields
          if (item.requirements) {
            Object.keys(item.requirements).forEach(k =>
              auditResults.requirementsFields.add(k)
            );
          }
        }
      }
    }
    
    // Check TREATMENT_HISTORY structure
    if (criterion.TREATMENT_HISTORY) {
      for (const th of criterion.TREATMENT_HISTORY) {
        Object.keys(th).forEach(k => 
          auditResults.treatmentHistoryFields.add(k)
        );
        if (th.timing) {
          Object.keys(th.timing).forEach(k =>
            auditResults.timeframeFields.add('timing.' + k)
          );
        }
      }
    }
    
    // Check TIMEFRAME structure
    if (criterion.TIMEFRAME) {
      const tf = Array.isArray(criterion.TIMEFRAME) ? criterion.TIMEFRAME : [criterion.TIMEFRAME];
      for (const t of tf) {
        if (t) Object.keys(t).forEach(k => auditResults.timeframeFields.add(k));
      }
    }
    
    // Check EXCEPTION_CONDITION structure
    if (criterion.EXCEPTION_CONDITION) {
      Object.keys(criterion.EXCEPTION_CONDITION).forEach(k =>
        auditResults.exceptionConditionFields.add(k)
      );
    }
    
    // Check NEGATION_DETECTED structure
    if (criterion.NEGATION_DETECTED) {
      Object.keys(criterion.NEGATION_DETECTED).forEach(k =>
        auditResults.negationDetectedFields.add(k)
      );
    }
  }
}

console.log('\n=== AUDIT RESULTS ===\n');

console.log('1. UNKNOWN TOP-LEVEL FIELDS (not in schema):');
console.log('   ' + ([...auditResults.unknownTopLevelFields].join(', ') || 'None'));

console.log('\n2. NESTED_ITEMS.type VALUES USED:');
[...auditResults.nestedItemTypes].forEach(t => console.log('   - ' + t));

console.log('\n3. NESTED_ITEMS SUBFIELDS:');
[...auditResults.nestedItemFields].forEach(f => console.log('   - ' + f));

console.log('\n4. NESTED_ITEMS.requirements SUBFIELDS:');
[...auditResults.requirementsFields].forEach(f => console.log('   - ' + f));

console.log('\n5. NESTED_CONDITION.main_condition SUBFIELDS:');
[...auditResults.mainConditionFields].forEach(f => console.log('   - ' + f));

console.log('\n6. TREATMENT_HISTORY SUBFIELDS:');
[...auditResults.treatmentHistoryFields].forEach(f => console.log('   - ' + f));

console.log('\n7. TIMEFRAME SUBFIELDS:');
[...auditResults.timeframeFields].forEach(f => console.log('   - ' + f));

console.log('\n8. EXCEPTION_CONDITION SUBFIELDS:');
[...auditResults.exceptionConditionFields].forEach(f => console.log('   - ' + f));

console.log('\n9. NEGATION_DETECTED SUBFIELDS:');
[...auditResults.negationDetectedFields].forEach(f => console.log('   - ' + f));

// Save results to JSON for further analysis
const resultsPath = path.join(__dirname, 'data/adhoc-audit-results.json');
const jsonResults = {};
for (const [key, set] of Object.entries(auditResults)) {
  jsonResults[key] = [...set].sort();
}
fs.writeFileSync(resultsPath, JSON.stringify(jsonResults, null, 2));
console.log(`\nResults saved to: ${resultsPath}`);
