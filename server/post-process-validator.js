/**
 * Post-process existing slot-filled data to ensure schema compliance
 * Applies output-validator to all criteria in the database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateCriterion } from './config/output-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INPUT_FILE = path.join(__dirname, 'data', 'slot-filled-cmb-output.json');
const OUTPUT_FILE = path.join(__dirname, 'data', 'slot-filled-cmb-output-validated.json');
const CLEAN_OUTPUT_FILE = path.join(__dirname, 'data', 'slot-filled-cmb-output-clean.json');

function main() {
  console.log('=== Post-Processing Validator ===\n');
  
  // Read input
  console.log(`Reading: ${INPUT_FILE}`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  
  console.log(`Found ${data.criteria.length} criteria\n`);
  
  let fixed = 0;
  let warnings = 0;
  
  // Process each criterion through validator
  data.criteria = data.criteria.map((criterion, idx) => {
    // Skip error criteria
    if (criterion.parsing_status === 'error') {
      return criterion;
    }
    
    try {
      const validation = validateCriterion(criterion, 'CMB');
      
      // Count fixes
      if (validation.criterion.CRITERION_TYPE !== criterion.CRITERION_TYPE ||
          validation.criterion.EXCLUSION_STRENGTH !== criterion.EXCLUSION_STRENGTH) {
        fixed++;
      }
      
      if (validation.warnings.length > 0) {
        warnings += validation.warnings.length;
      }
      
      return validation.criterion;
    } catch (error) {
      console.error(`Error validating criterion ${criterion.id}:`, error.message);
      return criterion;
    }
  });
  
  // Write validated output
  console.log(`Writing validated output to: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  
  // Write clean output (without 'original' field)
  const cleanData = {
    ...data,
    criteria: data.criteria.map(c => {
      const { original, ...clean } = c;
      return clean;
    })
  };
  console.log(`Writing clean output to: ${CLEAN_OUTPUT_FILE}`);
  fs.writeFileSync(CLEAN_OUTPUT_FILE, JSON.stringify(cleanData, null, 2));
  
  // Summary
  console.log('\n=== POST-PROCESSING COMPLETE ===');
  console.log(`Total criteria: ${data.criteria.length}`);
  console.log(`Criteria fixed: ${fixed}`);
  console.log(`Warnings generated: ${warnings}`);
  console.log(`\nOutput saved to: ${OUTPUT_FILE}`);
  console.log(`Clean output saved to: ${CLEAN_OUTPUT_FILE}`);
}

main();
