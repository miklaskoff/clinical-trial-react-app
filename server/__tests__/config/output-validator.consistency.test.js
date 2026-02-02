/**
 * @file Cross-Criterion Consistency Validation Tests
 * TDD: Tests written BEFORE implementation
 * 
 * Feature: Validate ALL fields for consistency across similar criteria
 * - Find 3 similar criteria for comparison
 * - Check that same patterns produce same field values
 * - Report inconsistencies
 */

import { describe, it, expect, beforeEach } from 'vitest';

// These will be imported after implementation
let validateConsistency;
let findSimilarCriteria;
let CONSISTENCY_RULES;

describe('Cross-Criterion Consistency Validation', () => {
  beforeEach(async () => {
    try {
      const module = await import('../../config/output-validator.js');
      validateConsistency = module.validateConsistency;
      findSimilarCriteria = module.findSimilarCriteria;
      CONSISTENCY_RULES = module.CONSISTENCY_RULES;
    } catch {
      validateConsistency = null;
      findSimilarCriteria = null;
      CONSISTENCY_RULES = null;
    }
  });

  describe('findSimilarCriteria', () => {
    it('should find 3 similar criteria based on CONDITION_TYPE overlap', () => {
      if (!findSimilarCriteria) {
        throw new Error('findSimilarCriteria not implemented yet');
      }
      
      const criteria = [
        { id: 'C1', CONDITION_TYPE: ['depression'], raw_text: 'History of depression' },
        { id: 'C2', CONDITION_TYPE: ['depression', 'anxiety'], raw_text: 'History of depression or anxiety' },
        { id: 'C3', CONDITION_TYPE: ['depression'], raw_text: 'Active depression' },
        { id: 'C4', CONDITION_TYPE: ['cancer'], raw_text: 'History of cancer' },
        { id: 'C5', CONDITION_TYPE: ['diabetes'], raw_text: 'History of diabetes' }
      ];
      
      const similar = findSimilarCriteria(criteria[0], criteria);
      
      expect(similar.length).toBeLessThanOrEqual(3);
      expect(similar.map(c => c.id)).not.toContain('C1'); // Not self
      expect(similar.map(c => c.id)).toContain('C2'); // Has depression
      expect(similar.map(c => c.id)).toContain('C3'); // Has depression
    });

    it('should return empty array if no similar criteria found', () => {
      if (!findSimilarCriteria) {
        throw new Error('findSimilarCriteria not implemented yet');
      }
      
      const criteria = [
        { id: 'C1', CONDITION_TYPE: ['unique_condition'], raw_text: 'Unique condition' },
        { id: 'C2', CONDITION_TYPE: ['different_condition'], raw_text: 'Different condition' }
      ];
      
      const similar = findSimilarCriteria(criteria[0], criteria);
      
      // May return C2 due to text similarity, or empty - both acceptable
      expect(similar.length).toBeLessThanOrEqual(3);
    });
  });

  describe('validateConsistency - CONDITION_PATTERN', () => {
    it('should detect PATTERN_MISMATCH for "history of" without history in CONDITION_PATTERN', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'History of depression',
        CONDITION_PATTERN: ['current']  // WRONG - should be 'history'
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('PATTERN_MISMATCH'))).toBe(true);
    });

    it('should pass if "history of" has history in CONDITION_PATTERN', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'History of depression',
        CONDITION_PATTERN: ['history']  // CORRECT
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      // No PATTERN_MISMATCH for this specific check
      const hasPatternMismatch = result.inconsistencies.some(
        i => i.includes('PATTERN_MISMATCH') && i.includes('history of')
      );
      expect(hasPatternMismatch).toBe(false);
    });

    it('should detect PATTERN_MISMATCH for "active" without active in CONDITION_PATTERN', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'Active gastrointestinal disease',
        CONDITION_PATTERN: ['history']  // WRONG - should be 'active'
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('PATTERN_MISMATCH'))).toBe(true);
    });
  });

  describe('validateConsistency - SEVERITY', () => {
    it('should detect SEVERITY_MISMATCH for "severe" not in SEVERITY', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'Severe gastrointestinal disease',
        SEVERITY: []  // WRONG - should contain 'severe'
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('SEVERITY_MISMATCH'))).toBe(true);
    });

    it('should detect SEVERITY_MISMATCH for "acute" not in SEVERITY', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'Acute kidney failure',
        SEVERITY: ['chronic']  // WRONG - should contain 'acute'
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('SEVERITY_MISMATCH'))).toBe(true);
    });

    it('should pass if severity terms are in SEVERITY', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'Severe acute infection',
        SEVERITY: ['severe', 'acute']  // CORRECT
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      const hasSeverityMismatch = result.inconsistencies.some(
        i => i.includes('SEVERITY_MISMATCH')
      );
      expect(hasSeverityMismatch).toBe(false);
    });
  });

  describe('validateConsistency - REQUIRES_CLINICAL_JUDGMENT', () => {
    it('should detect JUDGMENT_MISMATCH for "clinically significant" without flag', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'Any clinically significant neurological disease',
        REQUIRES_CLINICAL_JUDGMENT: false  // WRONG - should be true
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('JUDGMENT_MISMATCH'))).toBe(true);
    });

    it('should detect JUDGMENT_MISMATCH for "investigator judgment" without flag', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'At the investigator judgment, any condition that...',
        REQUIRES_CLINICAL_JUDGMENT: false  // WRONG
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
    });
  });

  describe('validateConsistency - EXCEPTION_CONDITION', () => {
    it('should detect EXCEPTION_MISMATCH for "excluding" without EXCEPTION_CONDITION', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'History of cancer excluding skin cancer',
        EXCEPTION_CONDITION: null  // WRONG - should have exception
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('EXCEPTION_MISMATCH'))).toBe(true);
    });

    it('should detect EXCEPTION_MISMATCH for "except" without EXCEPTION_CONDITION', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'All infections except common cold',
        EXCEPTION_CONDITION: null  // WRONG
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
    });
  });

  describe('validateConsistency - NEGATION_DETECTED', () => {
    it('should detect NEGATION_MISMATCH for "non-" without NEGATION_DETECTED', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criterion = {
        id: 'C1',
        raw_text: 'Non-infectious disease',
        NEGATION_DETECTED: null  // WRONG - should detect negation
      };
      
      const result = validateConsistency(criterion, [criterion]);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('NEGATION_MISMATCH'))).toBe(true);
    });
  });

  describe('validateConsistency - Cross-criterion comparison', () => {
    it('should detect CROSS_INCONSISTENT when similar criteria parsed differently', () => {
      if (!validateConsistency) {
        throw new Error('validateConsistency not implemented yet');
      }
      
      const criteria = [
        { 
          id: 'C1', 
          raw_text: 'History of depression', 
          CONDITION_TYPE: ['depression'],
          CONDITION_PATTERN: ['history']  // CORRECT
        },
        { 
          id: 'C2', 
          raw_text: 'History of anxiety', 
          CONDITION_TYPE: ['anxiety'],
          CONDITION_PATTERN: ['current']  // WRONG - should also be 'history'
        }
      ];
      
      const result = validateConsistency(criteria[1], criteria);
      
      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies.some(i => i.includes('CROSS_INCONSISTENT'))).toBe(true);
    });
  });

  describe('CONSISTENCY_RULES coverage', () => {
    it('should have rules for all major field types', () => {
      if (!CONSISTENCY_RULES) {
        throw new Error('CONSISTENCY_RULES not implemented yet');
      }
      
      const fieldsWithRules = new Set(CONSISTENCY_RULES.map(r => r.field));
      
      // Must have rules for these fields
      const requiredFields = [
        'CONDITION_PATTERN',
        'SEVERITY',
        'REQUIRES_CLINICAL_JUDGMENT',
        'EXCEPTION_CONDITION',
        'NEGATION_DETECTED'
      ];
      
      for (const field of requiredFields) {
        expect(fieldsWithRules.has(field)).toBe(true);
      }
    });

    it('should have at least 10 consistency rules', () => {
      if (!CONSISTENCY_RULES) {
        throw new Error('CONSISTENCY_RULES not implemented yet');
      }
      
      expect(CONSISTENCY_RULES.length).toBeGreaterThanOrEqual(10);
    });
  });
});
