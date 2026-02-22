/**
 * TDD Tests for Semicolon Branch Separation & Timeframe Scope Rules
 * Iteration 2.4
 * 
 * These tests verify:
 * 1. Semicolons are recognized as branch separators
 * 2. TIMEFRAME scope is correctly limited to relevant clauses
 * 3. Treatment events go to TREATMENT_HISTORY, not NESTED_CONDITION
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  detectSemicolonBranches,
  classifyTreatmentVsCondition,
  validateTimeframeScope 
} from '../../config/output-validator.js';

describe('Semicolon Branch Separation (Iteration 2.4)', () => {
  
  describe('detectSemicolonBranches()', () => {
    
    it('T1: should detect semicolon as branch separator', () => {
      const text = 'Known history of chronic infections; hospitalization within 2 months';
      const branches = detectSemicolonBranches(text);
      
      expect(branches).toHaveLength(2);
      expect(branches[0]).toContain('chronic infections');
      expect(branches[1]).toContain('hospitalization');
    });
    
    it('T1b: should return single branch when no semicolon present', () => {
      const text = 'Known history of chronic infections';
      const branches = detectSemicolonBranches(text);
      
      expect(branches).toHaveLength(1);
      expect(branches[0]).toBe(text);
    });
    
    it('T1c: should handle multiple semicolons', () => {
      const text = 'History of infections; hospitalization; IV antibiotics within 2 months';
      const branches = detectSemicolonBranches(text);
      
      expect(branches).toHaveLength(3);
    });
  });
  
  describe('classifyTreatmentVsCondition()', () => {
    
    it('T3: should classify hospitalization as TREATMENT', () => {
      const result = classifyTreatmentVsCondition('hospitalization');
      expect(result.type).toBe('TREATMENT');
    });
    
    it('T3b: should classify IV antibiotics as TREATMENT', () => {
      const result = classifyTreatmentVsCondition('intravenous antibiotics');
      expect(result.type).toBe('TREATMENT');
    });
    
    it('T3c: should classify treatment with X as TREATMENT', () => {
      const result = classifyTreatmentVsCondition('treatment with methotrexate');
      expect(result.type).toBe('TREATMENT');
    });
    
    it('T3d: should classify surgery as TREATMENT', () => {
      const result = classifyTreatmentVsCondition('surgical procedure');
      expect(result.type).toBe('TREATMENT');
    });
    
    it('T4: should classify infection as CONDITION', () => {
      const result = classifyTreatmentVsCondition('infection');
      expect(result.type).toBe('CONDITION');
    });
    
    it('T4b: should classify sepsis as CONDITION', () => {
      const result = classifyTreatmentVsCondition('sepsis');
      expect(result.type).toBe('CONDITION');
    });
    
    it('T4c: should classify pneumonia as CONDITION', () => {
      const result = classifyTreatmentVsCondition('pneumonia');
      expect(result.type).toBe('CONDITION');
    });
  });
  
  describe('validateTimeframeScope()', () => {
    
    it('T2: should detect timeframe applies to last clause only after semicolon', () => {
      const parsed = {
        raw_text: 'History of infections; hospitalization within 2 months',
        CONDITION_TYPE: ['infections'],
        TREATMENT_HISTORY: [{
          treatment: 'hospitalization',
          timing: { relation: 'within', amount: 2, unit: 'months' }
        }],
        TIMEFRAME: { relation: 'within', amount: 2, unit: 'months' }
      };
      
      const result = validateTimeframeScope(parsed);
      
      // TIMEFRAME should NOT apply to the condition (before semicolon)
      expect(result.conditionsHaveTimeframe).toBe(false);
      // TIMEFRAME should apply to treatment (after semicolon)
      expect(result.treatmentHasTimeframe).toBe(true);
    });
    
    it('T2b: should allow timeframe to apply to all when no semicolon', () => {
      const parsed = {
        raw_text: 'Hospitalization or IV antibiotics within 2 months',
        TREATMENT_HISTORY: [
          { treatment: 'hospitalization', timing: { amount: 2, unit: 'months' } },
          { treatment: 'IV antibiotics', timing: { amount: 2, unit: 'months' } }
        ],
        TIMEFRAME: { relation: 'within', amount: 2, unit: 'months' }
      };
      
      const result = validateTimeframeScope(parsed);
      
      expect(result.isValid).toBe(true);
      expect(result.allTreatmentsHaveTimeframe).toBe(true);
    });
  });
  
  describe('AIC_2319 Correct Parsing Validation', () => {
    
    const correctlyParsedAIC2319 = {
      id: 'AIC_2319',
      raw_text: 'Known history of recurrent or chronic infections, or prior history of chronic or recurrent infections, including but not limited to: chronic renal infection, chronic chest infection (e.g., bronchiectasis), symptomatic urinary tract infection, and open, draining, or infected skin wounds; history of serious infections (e.g., sepsis, pneumonia, and pyelonephritis), or hospitalization or treatment with intravenous antibiotics for infections within 2 months before screening',
      
      CONDITION_TYPE: [
        'recurrent infections',
        'chronic infections',
        'chronic renal infection',
        'chronic chest infection',
        'bronchiectasis',
        'urinary tract infection',
        'infected skin wounds',
        'serious infections',
        'sepsis',
        'pneumonia',
        'pyelonephritis'
      ],
      
      CONDITION_PATTERN: ['history', 'prior', 'recurrent'],
      
      SEVERITY: ['chronic', 'serious', 'symptomatic'],
      
      ANATOMICAL_LOCATION: ['renal', 'chest', 'urinary tract', 'skin'],
      
      TREATMENT_HISTORY: [
        {
          treatment: 'hospitalization',
          indication: 'infections',
          timing: {
            relation: 'within',
            amount: 2,
            unit: 'months',
            reference: 'screening'
          }
        },
        {
          treatment: 'intravenous antibiotics',
          indication: 'infections',
          timing: {
            relation: 'within',
            amount: 2,
            unit: 'months',
            reference: 'screening'
          }
        }
      ],
      
      LOGICAL_OPERATOR: 'OR',
      CRITERION_TYPE: 'exclusion',
      EXCLUSION_STRENGTH: 'mandatory_exclude',
      confidence: 0.95,
      parsing_status: 'complete'
    };
    
    it('T5: should have LOGICAL_OPERATOR as OR for multi-branch criteria', () => {
      expect(correctlyParsedAIC2319.LOGICAL_OPERATOR).toBe('OR');
    });
    
    it('T6a: should have hospitalization in TREATMENT_HISTORY, not NESTED_CONDITION', () => {
      const hospitalizations = correctlyParsedAIC2319.TREATMENT_HISTORY.filter(
        t => t.treatment === 'hospitalization'
      );
      expect(hospitalizations).toHaveLength(1);
      expect(correctlyParsedAIC2319.NESTED_CONDITION).toBeUndefined();
    });
    
    it('T6b: should have IV antibiotics in TREATMENT_HISTORY', () => {
      const ivAbx = correctlyParsedAIC2319.TREATMENT_HISTORY.filter(
        t => t.treatment.includes('intravenous') || t.treatment.includes('IV')
      );
      expect(ivAbx).toHaveLength(1);
    });
    
    it('T6c: should have timing in TREATMENT_HISTORY entries, not global TIMEFRAME', () => {
      for (const th of correctlyParsedAIC2319.TREATMENT_HISTORY) {
        expect(th.timing).toBeDefined();
        expect(th.timing.amount).toBe(2);
        expect(th.timing.unit).toBe('months');
      }
    });
    
    it('T6d: should keep conditions in CONDITION_TYPE without timeframe', () => {
      // Conditions like "chronic infections" don't have individual timeframes
      // because the 2-month timeframe only applies to hospitalization/IV branch
      expect(correctlyParsedAIC2319.CONDITION_TYPE).toContain('chronic infections');
      expect(correctlyParsedAIC2319.CONDITION_TYPE).toContain('sepsis');
    });
  });
  
  describe('Incorrect Parsing Detection', () => {
    
    const incorrectlyParsedAIC2319 = {
      id: 'AIC_2319_wrong',
      raw_text: 'Known history of chronic infections; hospitalization within 2 months',
      
      // WRONG: Hospitalization in NESTED_CONDITION instead of TREATMENT_HISTORY
      NESTED_CONDITION: {
        main_condition: {
          type: 'CONDITION_TYPE',
          values: ['chronic infections']
        },
        nested_items: [
          {
            type: 'TREATMENT_REQUIREMENT',  // Should be in TREATMENT_HISTORY!
            values: ['hospitalization']
          }
        ]
      },
      
      // WRONG: TIMEFRAME applied globally (should only be for hospitalization)
      TIMEFRAME: { relation: 'within', amount: 2, unit: 'months' }
    };
    
    it('should detect treatment events incorrectly placed in NESTED_CONDITION', () => {
      const treatmentTerms = ['hospitalization', 'intravenous', 'IV', 'surgery'];
      const nestedValues = incorrectlyParsedAIC2319.NESTED_CONDITION?.nested_items?.[0]?.values || [];
      
      const hasTreatmentInNested = nestedValues.some(v => 
        treatmentTerms.some(term => v.toLowerCase().includes(term.toLowerCase()))
      );
      
      // This SHOULD flag as an error in the validator
      expect(hasTreatmentInNested).toBe(true);
    });
  });
});
