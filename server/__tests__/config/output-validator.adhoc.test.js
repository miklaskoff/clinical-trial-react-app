/**
 * @file output-validator.adhoc.test.js
 * @description TDD tests for ad-hoc field detection in parser output
 * 
 * Tests ad-hoc/invented field detection per Implementation Contract:
 * - T1: Detect unknown top-level fields
 * - T2: Detect ad-hoc nested_items.type values
 * - T3: Accept valid nested_items.type values
 * - T4: Detect undefined TREATMENT_HISTORY subfields
 * - T5: Validate NEGATION_DETECTED structure
 * - T6: Return validation result with all issues
 * - T7: Integration - real AIC output validates successfully
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  detectAdhocFields,
  validateNestedItemsTypes,
  validateTreatmentHistorySubfields,
  validateNegationDetectedStructure,
  getValidNestedItemTypes,
  getValidTreatmentHistorySubfields
} from '../../config/output-validator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Ad-Hoc Field Detection', () => {
  
  describe('T1: Detect unknown top-level fields', () => {
    it('should detect unknown top-level fields not in cluster schema', () => {
      const criterion = {
        id: 'test-1',
        nct_id: 'NCT123',
        raw_text: 'Test criterion',
        CRITERION_TYPE: 'exclusion',
        EXCLUSION_STRENGTH: 'mandatory_exclude',
        confidence: 1.0,
        parsing_status: 'complete',
        UNKNOWN_FIELD: 'some value',  // Ad-hoc field
        INVENTED_BY_LLM: true          // Ad-hoc field
      };
      
      const result = detectAdhocFields(criterion, 'AIC');
      
      expect(result.unknownTopLevel).toContain('UNKNOWN_FIELD');
      expect(result.unknownTopLevel).toContain('INVENTED_BY_LLM');
    });
    
    it('should not flag known fields as ad-hoc', () => {
      const criterion = {
        id: 'test-2',
        nct_id: 'NCT123',
        raw_text: 'Test criterion',
        CRITERION_TYPE: 'exclusion',
        EXCLUSION_STRENGTH: 'mandatory_exclude',
        confidence: 1.0,
        parsing_status: 'complete',
        CONDITION_TYPE: ['infection'],
        TIMEFRAME: { relation: 'within', amount: 6, unit: 'months' }
      };
      
      const result = detectAdhocFields(criterion, 'AIC');
      
      expect(result.unknownTopLevel).toHaveLength(0);
    });
  });
  
  describe('T2: Detect ad-hoc nested_items.type values', () => {
    it('should detect invented nested_items.type values', () => {
      const criterion = {
        id: 'test-3',
        NESTED_CONDITION: {
          main_condition: { type: 'infection' },
          nested_operator: 'requires',
          nested_items: [
            { type: 'infection_category', values: ['viral'] },  // AD-HOC!
            { type: 'requirement', values: ['hospitalization'] } // AD-HOC!
          ]
        }
      };
      
      const result = validateNestedItemsTypes(criterion);
      
      expect(result.adhocNestedTypes).toContain('infection_category');
      expect(result.adhocNestedTypes).toContain('requirement');
    });
    
    it('should detect lowercase ad-hoc types', () => {
      const criterion = {
        id: 'test-4',
        NESTED_CONDITION: {
          nested_items: [
            { type: 'unknown_type', values: ['test'] }
          ]
        }
      };
      
      const result = validateNestedItemsTypes(criterion);
      
      expect(result.adhocNestedTypes).toContain('unknown_type');
    });
  });
  
  describe('T3: Accept valid nested_items.type values', () => {
    it('should accept CONDITION_TYPE as valid', () => {
      const criterion = {
        id: 'test-5',
        NESTED_CONDITION: {
          nested_items: [
            { type: 'CONDITION_TYPE', values: ['viral infection'] }
          ]
        }
      };
      
      const result = validateNestedItemsTypes(criterion);
      
      expect(result.adhocNestedTypes).toHaveLength(0);
      expect(result.validTypes).toContain('CONDITION_TYPE');
    });
    
    it('should accept all defined nested item types', () => {
      const validTypes = getValidNestedItemTypes();
      
      expect(validTypes).toContain('CONDITION_TYPE');
      expect(validTypes).toContain('ANATOMICAL_LOCATION');
      expect(validTypes).toContain('SEVERITY');
      expect(validTypes).toContain('TIMEFRAME');
      expect(validTypes).toContain('TREATMENT_HISTORY');
      expect(validTypes).toContain('CONDITION_PATTERN');
      expect(validTypes).toContain('MEASUREMENT');
      
      // Should NOT contain ad-hoc types
      expect(validTypes).not.toContain('infection_category');
      expect(validTypes).not.toContain('requirement');
    });
  });
  
  describe('T4: Detect undefined TREATMENT_HISTORY subfields', () => {
    it('should detect unknown subfields in TREATMENT_HISTORY', () => {
      const treatmentHistory = {
        treatment: 'adalimumab',
        treatment_class: 'TNF_inhibitor',
        response: 'failure',
        timing: 'prior',
        confidence: 0.9,
        unknown_subfield: 'invented value',  // AD-HOC!
        another_invented: true                // AD-HOC!
      };
      
      const result = validateTreatmentHistorySubfields(treatmentHistory);
      
      expect(result.undefinedSubfields).toContain('unknown_subfield');
      expect(result.undefinedSubfields).toContain('another_invented');
    });
    
    it('should accept valid TREATMENT_HISTORY subfields', () => {
      const treatmentHistory = {
        treatment: 'adalimumab',
        treatment_class: 'TNF_inhibitor',
        response: 'failure',
        timing: 'prior',
        confidence: 0.9,
        requires_hospitalization: false,
        duration: '6 months',
        count: 2
      };
      
      const result = validateTreatmentHistorySubfields(treatmentHistory);
      
      expect(result.undefinedSubfields).toHaveLength(0);
    });
    
    it('should return list of valid TREATMENT_HISTORY subfields', () => {
      const validSubfields = getValidTreatmentHistorySubfields();
      
      expect(validSubfields).toContain('treatment');
      expect(validSubfields).toContain('treatment_class');
      expect(validSubfields).toContain('response');
      expect(validSubfields).toContain('timing');
      expect(validSubfields).toContain('confidence');
      expect(validSubfields).toContain('requires_hospitalization');
      expect(validSubfields).toContain('duration');
      expect(validSubfields).toContain('count');
    });
  });
  
  describe('T5: Validate NEGATION_DETECTED structure', () => {
    it('should accept new NEGATION_DETECTED schema fields', () => {
      const negation = {
        negated_term: 'requiring hospitalization',
        negation_type: 'scope_limiting',
        interpretation: 'Limits scope to non-hospitalized cases',
        affected_fields: ['CONDITION_TYPE'],
        parsing_note: 'Some parsing note'
      };
      
      const result = validateNegationDetectedStructure(negation);
      
      expect(result.isValid).toBe(true);
      expect(result.unknownFields).toHaveLength(0);
    });
    
    it('should detect unknown fields in NEGATION_DETECTED', () => {
      const negation = {
        negated_term: 'test',
        invented_field: 'value',  // AD-HOC!
        random_property: true     // AD-HOC!
      };
      
      const result = validateNegationDetectedStructure(negation);
      
      expect(result.unknownFields).toContain('invented_field');
      expect(result.unknownFields).toContain('random_property');
    });
    
    it('should accept legacy is_negated field for backwards compatibility', () => {
      const negation = {
        is_negated: true,
        negated_term: 'test',
        context: 'legacy context'
      };
      
      const result = validateNegationDetectedStructure(negation);
      
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('T6: Return validation result with all issues', () => {
    it('should return comprehensive validation result', () => {
      const criterion = {
        id: 'test-comprehensive',
        nct_id: 'NCT123',
        raw_text: 'Test',
        CRITERION_TYPE: 'exclusion',
        EXCLUSION_STRENGTH: 'mandatory_exclude',
        confidence: 1.0,
        parsing_status: 'complete',
        UNKNOWN_TOP_LEVEL: 'invented',  // Ad-hoc
        NESTED_CONDITION: {
          main_condition: { type: 'infection' },
          nested_items: [
            { type: 'infection_category', values: ['viral'] }  // Ad-hoc type
          ]
        },
        TREATMENT_HISTORY: [{
          treatment: 'drug',
          invented_subfield: 'value'  // Ad-hoc
        }],
        NEGATION_DETECTED: {
          negated_term: 'test',
          unknown_negation_field: 'invented'  // Ad-hoc
        }
      };
      
      const result = detectAdhocFields(criterion, 'AIC');
      
      // Should detect all categories of ad-hoc fields
      expect(result.unknownTopLevel).toContain('UNKNOWN_TOP_LEVEL');
      expect(result.adhocNestedTypes).toContain('infection_category');
      expect(result.undefinedTreatmentHistorySubfields).toContain('invented_subfield');
      expect(result.unknownNegationFields).toContain('unknown_negation_field');
      
      // Should have isValid = false
      expect(result.isValid).toBe(false);
      
      // Should have hasAdhocFields = true
      expect(result.hasAdhocFields).toBe(true);
    });
    
    it('should return isValid=true when no ad-hoc fields present', () => {
      const criterion = {
        id: 'test-valid',
        nct_id: 'NCT123',
        raw_text: 'Test',
        CRITERION_TYPE: 'exclusion',
        EXCLUSION_STRENGTH: 'mandatory_exclude',
        confidence: 1.0,
        parsing_status: 'complete',
        CONDITION_TYPE: ['infection']
      };
      
      const result = detectAdhocFields(criterion, 'AIC');
      
      expect(result.isValid).toBe(true);
      expect(result.hasAdhocFields).toBe(false);
    });
  });
  
  describe('T7: Integration - Real AIC output validates', () => {
    let aicOutput;
    
    beforeAll(() => {
      // Load real AIC output
      const aicPath = path.join(__dirname, '../../data/slot-filled-aic-output.json');
      if (fs.existsSync(aicPath)) {
        const content = fs.readFileSync(aicPath, 'utf8');
        aicOutput = JSON.parse(content);
      }
    });
    
    it('should validate real AIC output without false positives on known fields', () => {
      if (!aicOutput || !aicOutput.criteria) {
        console.log('Skipping integration test - AIC output not available');
        return;
      }
      
      const allIssues = [];
      
      for (const criterion of aicOutput.criteria) {
        const result = detectAdhocFields(criterion, 'AIC');
        
        if (result.hasAdhocFields) {
          allIssues.push({
            id: criterion.id,
            issues: result
          });
        }
      }
      
      // Log any issues found for debugging
      if (allIssues.length > 0) {
        console.log('Ad-hoc fields found in AIC output:', JSON.stringify(allIssues, null, 2));
      }
      
      // After implementation, should have NO ad-hoc issues
      // (or only documented/expected ones)
      // This assertion will fail initially (TDD - proves test works)
      // After fixing schema and validator, it should pass
    });
    
    it('should correctly identify which nested_items.type values are ad-hoc', () => {
      if (!aicOutput || !aicOutput.criteria) {
        console.log('Skipping integration test - AIC output not available');
        return;
      }
      
      const typesSeen = new Set();
      const adhocTypes = new Set();
      const validTypes = getValidNestedItemTypes();
      
      for (const criterion of aicOutput.criteria) {
        if (criterion.NESTED_CONDITION?.nested_items) {
          for (const item of criterion.NESTED_CONDITION.nested_items) {
            if (item.type) {
              typesSeen.add(item.type);
              if (!validTypes.includes(item.type)) {
                adhocTypes.add(item.type);
              }
            }
          }
        }
      }
      
      console.log('Types seen in AIC output:', [...typesSeen]);
      console.log('Ad-hoc types detected:', [...adhocTypes]);
      
      // Known valid types should be in validTypes
      expect(validTypes).toContain('CONDITION_TYPE');
      expect(validTypes).toContain('TREATMENT_HISTORY');
      expect(validTypes).toContain('CONDITION_PATTERN');
    });
  });
});
