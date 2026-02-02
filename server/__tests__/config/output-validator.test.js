/**
 * @file output-validator.test.js
 * @description TDD tests for output schema validator
 * 
 * Tests written FIRST per TDD requirements from copilot-instructions.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  validateCriterion, 
  addMissingFields,
  validateFieldTypes,
  getSchemaForCluster,
  ValidationResult
} from '../../config/output-validator.js';

describe('OutputValidator', () => {
  
  describe('getSchemaForCluster', () => {
    it('should return CMB schema with all required fields', () => {
      const schema = getSchemaForCluster('CMB');
      
      expect(schema).toBeDefined();
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('nct_id');
      expect(schema.required).toContain('raw_text');
      expect(schema.required).toContain('CRITERION_TYPE');
      expect(schema.required).toContain('EXCLUSION_STRENGTH');
      expect(schema.required).toContain('CONDITION_TYPE');
      expect(schema.required).toContain('confidence');
      expect(schema.required).toContain('parsing_status');
    });

    it('should return AGE schema with age-specific fields', () => {
      const schema = getSchemaForCluster('AGE');
      
      expect(schema).toBeDefined();
      expect(schema.optional).toContain('AGE_MIN');
      expect(schema.optional).toContain('AGE_MAX');
      expect(schema.optional).toContain('AGE_UNIT');
    });

    it('should throw error for unknown cluster', () => {
      expect(() => getSchemaForCluster('UNKNOWN')).toThrow('Unknown cluster');
    });
  });

  describe('addMissingFields', () => {
    it('should add EXCLUSION_STRENGTH when missing', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'History of cancer',
        CONDITION_TYPE: ['cancer'],
        original: { criterion_type: 'exclusion' }
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.EXCLUSION_STRENGTH).toBe('mandatory_exclude');
    });

    it('should add CRITERION_TYPE from original.criterion_type', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'History of cancer',
        CONDITION_TYPE: ['cancer'],
        original: { criterion_type: 'exclusion' }
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.CRITERION_TYPE).toBe('exclusion');
    });

    it('should add CRITERION_TYPE as inclusion for inclusion criteria', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Must have diagnosis',
        CONDITION_TYPE: ['diagnosis'],
        original: { criterion_type: 'inclusion' }
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.CRITERION_TYPE).toBe('inclusion');
      expect(result.EXCLUSION_STRENGTH).toBe('mandatory_include');
    });

    it('should add default confidence if missing', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Test',
        CONDITION_TYPE: []
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });

    it('should add parsing_status if missing', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Test',
        CONDITION_TYPE: []
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.parsing_status).toBe('complete');
    });

    it('should add SUBJECTIVE_ESTIMATE from REQUIRES_CLINICAL_JUDGMENT', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Clinically significant condition',
        CONDITION_TYPE: ['condition'],
        REQUIRES_CLINICAL_JUDGMENT: true
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.SUBJECTIVE_ESTIMATE).toBe(true);
    });

    it('should NOT overwrite existing fields', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Test',
        CONDITION_TYPE: ['existing'],
        EXCLUSION_STRENGTH: 'conditional_exclude',
        CRITERION_TYPE: 'exclusion',
        confidence: 0.85
      };

      const result = addMissingFields(input, 'CMB');

      expect(result.EXCLUSION_STRENGTH).toBe('conditional_exclude');
      expect(result.confidence).toBe(0.85);
    });
  });

  describe('validateFieldTypes', () => {
    it('should convert string CONDITION_TYPE to array', () => {
      const input = {
        id: 'CMB_001',
        CONDITION_TYPE: 'single condition'
      };

      const result = validateFieldTypes(input, 'CMB');

      expect(Array.isArray(result.criterion.CONDITION_TYPE)).toBe(true);
      expect(result.criterion.CONDITION_TYPE).toEqual(['single condition']);
    });

    it('should convert string CONDITION_PATTERN to array', () => {
      const input = {
        id: 'CMB_001',
        CONDITION_PATTERN: 'current'
      };

      const result = validateFieldTypes(input, 'CMB');

      expect(Array.isArray(result.criterion.CONDITION_PATTERN)).toBe(true);
      expect(result.criterion.CONDITION_PATTERN).toEqual(['current']);
    });

    it('should convert string SEVERITY to array', () => {
      const input = {
        id: 'CMB_001',
        SEVERITY: 'severe'
      };

      const result = validateFieldTypes(input, 'CMB');

      expect(Array.isArray(result.criterion.SEVERITY)).toBe(true);
    });

    it('should validate LOGICAL_OPERATOR is AND, OR, or null', () => {
      const validInput = {
        id: 'CMB_001',
        LOGICAL_OPERATOR: 'AND'
      };

      const result = validateFieldTypes(validInput, 'CMB');
      expect(result.errors).toHaveLength(0);

      const invalidInput = {
        id: 'CMB_001',
        LOGICAL_OPERATOR: 'XOR'
      };

      const invalidResult = validateFieldTypes(invalidInput, 'CMB');
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.errors[0]).toContain('LOGICAL_OPERATOR');
    });

    it('should validate EXCLUSION_STRENGTH enum values', () => {
      const validInput = {
        id: 'CMB_001',
        EXCLUSION_STRENGTH: 'mandatory_exclude'
      };

      const result = validateFieldTypes(validInput, 'CMB');
      expect(result.errors).toHaveLength(0);

      const invalidInput = {
        id: 'CMB_001',
        EXCLUSION_STRENGTH: 'invalid_value'
      };

      const invalidResult = validateFieldTypes(invalidInput, 'CMB');
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should validate MEASUREMENTS is array of objects', () => {
      const validInput = {
        id: 'CMB_001',
        MEASUREMENTS: [
          { parameter: 'NYHA', value: 3, comparison: '>=', unit: 'class' }
        ]
      };

      const result = validateFieldTypes(validInput, 'CMB');
      expect(result.errors).toHaveLength(0);

      const invalidInput = {
        id: 'CMB_001',
        MEASUREMENTS: 'not an array'
      };

      const invalidResult = validateFieldTypes(invalidInput, 'CMB');
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should validate NESTED_CONDITION structure', () => {
      const validInput = {
        id: 'CMB_001',
        NESTED_CONDITION: {
          main_condition: { type: 'CONDITION_TYPE', value: 'arrhythmias' },
          nested_operator: 'any',
          nested_items: [],
          nested_logical_operator: 'OR'
        }
      };

      const result = validateFieldTypes(validInput, 'CMB');
      expect(result.errors).toHaveLength(0);
    });

    it('should add warning for NESTED_CONDITION missing required sub-fields', () => {
      const input = {
        id: 'CMB_001',
        NESTED_CONDITION: {
          main_condition: { value: 'arrhythmias' }
          // missing nested_operator, nested_items
        }
      };

      const result = validateFieldTypes(input, 'CMB');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateCriterion (integration)', () => {
    it('should return fully validated criterion with all required fields', () => {
      const rawLLMOutput = {
        id: 'CMB_2471',
        nct_id: 'NCT06170840',
        raw_text: 'Peripheral artery disease with stroke should be excluded',
        _thought_process: 'Step 1: Identify exclusion...',
        CONDITION_TYPE: ['peripheral artery disease', 'stroke'],
        CONDITION_PATTERN: ['current', 'diagnosed'],
        SEVERITY: [],
        ANATOMICAL_LOCATION: ['peripheral arteries', 'brain'],
        LOGICAL_OPERATOR: 'AND',
        NESTED_CONDITION: {
          main_condition: { type: 'CONDITION_TYPE', value: 'peripheral artery disease' },
          nested_operator: 'any',
          nested_items: [{ type: 'CONDITION_TYPE', values: ['ischemic stroke'] }],
          nested_logical_operator: 'OR'
        },
        confidence: 0.9,
        unfamiliar_term_flag: false,
        original: {
          code: 'peripheral_artery_disease',
          parsed_category: 'Concomitant Medical Conditions',
          criterion_type: 'exclusion'
        }
      };

      const result = validateCriterion(rawLLMOutput, 'CMB');

      // Check it's a valid result object
      expect(result).toBeDefined();
      expect(result.criterion).toBeDefined();
      expect(result.isValid).toBe(true);
      
      // Check required fields are present
      expect(result.criterion.EXCLUSION_STRENGTH).toBe('mandatory_exclude');
      expect(result.criterion.CRITERION_TYPE).toBe('exclusion');
      expect(result.criterion.parsing_status).toBeDefined();
      
      // Check arrays are arrays
      expect(Array.isArray(result.criterion.CONDITION_TYPE)).toBe(true);
      expect(Array.isArray(result.criterion.SEVERITY)).toBe(true);
    });

    it('should return validation errors for invalid input', () => {
      const invalidInput = {
        // Missing required id, nct_id, raw_text
        CONDITION_TYPE: 'not an array',
        LOGICAL_OPERATOR: 'INVALID'
      };

      const result = validateCriterion(invalidInput, 'CMB');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle both exclusion types correctly', () => {
      const exclusion = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Cancer excluded',
        CONDITION_TYPE: ['cancer'],
        original: { criterion_type: 'exclusion' }
      };

      const inclusion = {
        id: 'CMB_002',
        nct_id: 'NCT123',
        raw_text: 'Must have diabetes',
        CONDITION_TYPE: ['diabetes'],
        original: { criterion_type: 'inclusion' }
      };

      const exclusionResult = validateCriterion(exclusion, 'CMB');
      const inclusionResult = validateCriterion(inclusion, 'CMB');

      expect(exclusionResult.criterion.EXCLUSION_STRENGTH).toBe('mandatory_exclude');
      expect(inclusionResult.criterion.EXCLUSION_STRENGTH).toBe('mandatory_include');
    });
  });

  describe('ValidationResult type', () => {
    it('should have correct structure', () => {
      const input = {
        id: 'CMB_001',
        nct_id: 'NCT123',
        raw_text: 'Test',
        CONDITION_TYPE: ['test'],
        original: { criterion_type: 'exclusion' }
      };

      const result = validateCriterion(input, 'CMB');

      expect(result).toHaveProperty('criterion');
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Extended Field Validation', () => {
    describe('TIMEFRAME validation', () => {
      it('should validate TIMEFRAME object structure', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Within 6 months',
          CONDITION_TYPE: ['surgery'],
          TIMEFRAME: {
            relation: 'within',
            amount: 6,
            unit: 'months',
            reference: 'screening'
          },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should error if TIMEFRAME is not an object', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Within 6 months',
          CONDITION_TYPE: ['surgery'],
          TIMEFRAME: '6 months',
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('TIMEFRAME must be an object, got string');
      });

      it('should warn for invalid TIMEFRAME.relation', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          TIMEFRAME: { relation: 'invalid_relation', amount: 6, unit: 'months' },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.warnings.some(w => w.includes('TIMEFRAME.relation'))).toBe(true);
      });

      it('should error if TIMEFRAME.amount is not a number', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          TIMEFRAME: { relation: 'within', amount: 'six', unit: 'months' },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('TIMEFRAME.amount must be a number, got string');
      });
    });

    describe('EXCEPTION_CONDITION validation', () => {
      it('should validate EXCEPTION_CONDITION object structure', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Cancer excluded except skin cancer',
          CONDITION_TYPE: ['cancer'],
          EXCEPTION_CONDITION: {
            excluded_types: ['skin cancer', 'basal cell'],
            condition: 'cured',
            makes_eligible: true
          },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.isValid).toBe(true);
      });

      it('should error if EXCEPTION_CONDITION is not an object', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          EXCEPTION_CONDITION: 'skin cancer',
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('EXCEPTION_CONDITION must be an object, got string');
      });

      it('should error if excluded_types is not an array', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          EXCEPTION_CONDITION: { excluded_types: 'skin cancer' },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('EXCEPTION_CONDITION.excluded_types must be an array');
      });
    });

    describe('NEGATION_DETECTED validation', () => {
      it('should validate NEGATION_DETECTED object structure', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'No history of diabetes',
          CONDITION_TYPE: ['diabetes'],
          NEGATION_DETECTED: {
            is_negated: true,
            negated_term: 'diabetes',
            context: 'No history'
          },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.isValid).toBe(true);
      });

      it('should error if NEGATION_DETECTED is not an object', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          NEGATION_DETECTED: true,
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('NEGATION_DETECTED must be an object, got boolean');
      });

      it('should error if is_negated is not boolean', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          NEGATION_DETECTED: { is_negated: 'yes' },
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('NEGATION_DETECTED.is_negated must be a boolean');
      });
    });

    describe('Boolean field validation', () => {
      it('should validate boolean fields correctly', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          REQUIRES_CLINICAL_JUDGMENT: true,
          AMBIGUITY_FLAG: false,
          unfamiliar_term_flag: false,
          SUBJECTIVE_ESTIMATE: true,
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.isValid).toBe(true);
        expect(result.criterion.REQUIRES_CLINICAL_JUDGMENT).toBe(true);
        expect(result.criterion.AMBIGUITY_FLAG).toBe(false);
      });

      it('should convert string "true" to boolean true', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          REQUIRES_CLINICAL_JUDGMENT: 'true',
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.criterion.REQUIRES_CLINICAL_JUDGMENT).toBe(true);
        expect(result.warnings.some(w => w.includes('REQUIRES_CLINICAL_JUDGMENT was string'))).toBe(true);
      });

      it('should error for invalid boolean value', () => {
        const input = {
          id: 'CMB_001',
          nct_id: 'NCT123',
          raw_text: 'Test',
          CONDITION_TYPE: ['test'],
          AMBIGUITY_FLAG: 1,
          original: { criterion_type: 'exclusion' }
        };

        const result = validateCriterion(input, 'CMB');

        expect(result.errors).toContain('AMBIGUITY_FLAG must be a boolean, got number');
      });
    });

    describe('AGE cluster fields', () => {
      it('should validate AGE_MIN and AGE_MAX as numbers', () => {
        const input = {
          id: 'AGE_001',
          nct_id: 'NCT123',
          raw_text: 'Age 18-65',
          AGE_MIN: 18,
          AGE_MAX: 65,
          AGE_UNIT: 'years',
          original: { criterion_type: 'inclusion' }
        };

        const result = validateCriterion(input, 'AGE');

        expect(result.isValid).toBe(true);
        expect(result.criterion.AGE_MIN).toBe(18);
        expect(result.criterion.AGE_MAX).toBe(65);
      });

      it('should error if AGE_MIN is not a number', () => {
        const input = {
          id: 'AGE_001',
          nct_id: 'NCT123',
          raw_text: 'Age 18 and above',
          AGE_MIN: '18',
          original: { criterion_type: 'inclusion' }
        };

        const result = validateCriterion(input, 'AGE');

        expect(result.errors).toContain('AGE_MIN must be a number or null, got string');
      });

      it('should allow null for AGE_MAX', () => {
        const input = {
          id: 'AGE_001',
          nct_id: 'NCT123',
          raw_text: 'Age 18 and above',
          AGE_MIN: 18,
          AGE_MAX: null,
          original: { criterion_type: 'inclusion' }
        };

        const result = validateCriterion(input, 'AGE');

        expect(result.isValid).toBe(true);
      });
    });

    describe('BMI cluster fields', () => {
      it('should validate BMI_MIN, BMI_MAX, WEIGHT fields as numbers', () => {
        const input = {
          id: 'BMI_001',
          nct_id: 'NCT123',
          raw_text: 'BMI 18.5-30',
          BMI_MIN: 18.5,
          BMI_MAX: 30,
          WEIGHT_MIN: 50,
          WEIGHT_MAX: 100,
          WEIGHT_UNIT: 'kg',
          original: { criterion_type: 'inclusion' }
        };

        const result = validateCriterion(input, 'BMI');

        expect(result.isValid).toBe(true);
        expect(result.criterion.BMI_MIN).toBe(18.5);
        expect(result.criterion.BMI_MAX).toBe(30);
      });

      it('should error if BMI_MIN is not a number', () => {
        const input = {
          id: 'BMI_001',
          nct_id: 'NCT123',
          raw_text: 'BMI 18.5 minimum',
          BMI_MIN: 'normal',
          original: { criterion_type: 'inclusion' }
        };

        const result = validateCriterion(input, 'BMI');

        expect(result.errors).toContain('BMI_MIN must be a number or null, got string');
      });
    });
  });
});
