/**
 * @file MatcherAdvanced.test.js
 * @description TDD tests for EXCEPTION_CONDITION and NESTED_CONDITION matching
 * 
 * Based on FIELD_CATALOG_v2.1.md specifications:
 * - EXCEPTION_CONDITION: Exception clauses that override exclusion criteria
 * - NESTED_CONDITION: Structured nested logical conditions for patient matching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClinicalTrialMatcher } from '../../services/matcher/ClinicalTrialMatcher.js';

// Mock database with test criteria
const createMockDatabase = () => ({
  CLUSTER_CMB: {
    criteria: [
      {
        id: 'CMB_2036',
        nct_id: 'NCT12345678',
        raw_text: 'History of cancer except basal cell carcinoma',
        CONDITION_TYPE: ['cancer'],
        CONDITION_PATTERN: ['history'],
        EXCLUSION_STRENGTH: 'mandatory_exclude',
        EXCEPTION_CONDITION: {
          excluded_types: ['basal cell carcinoma'],
          condition: 'any status',
          makes_eligible: true
        }
      },
      {
        id: 'CMB_2037',
        nct_id: 'NCT12345678',
        raw_text: 'History of malignancy except non-melanoma skin cancer',
        CONDITION_TYPE: ['malignancy'],
        CONDITION_PATTERN: ['history'],
        EXCLUSION_STRENGTH: 'mandatory_exclude',
        EXCEPTION_CONDITION: {
          excluded_types: ['non-melanoma skin cancer', 'basal cell carcinoma', 'squamous cell carcinoma'],
          condition: 'any status',
          makes_eligible: true
        }
      }
    ]
  },
  CLUSTER_SEV: {
    criteria: [
      {
        id: 'SEV_1597',
        nct_id: 'NCT06672393',
        raw_text: 'PASI score is ≥10 and <12 with at least one of the following: facial or scalp involvement',
        MEASUREMENTS: [{ parameter: 'PASI', min: 10, max: 12, comparison: 'range' }],
        ANATOMICAL_LOCATION: ['facial', 'scalp'],
        EXCLUSION_STRENGTH: 'inclusion',
        NESTED_CONDITION: {
          main_condition: { parameter: 'PASI', min: 10, max: 12, comparison: 'range' },
          nested_operator: 'at_least_one',
          nested_items: [{ type: 'ANATOMICAL_LOCATION', values: ['facial', 'scalp'] }],
          nested_logical_operator: 'OR'
        }
      },
      {
        id: 'SEV_1598',
        nct_id: 'NCT06672393',
        raw_text: 'BSA ≥ 10% with involvement of at least two of: scalp, face, hands, feet',
        MEASUREMENTS: [{ parameter: 'BSA', value: 10, comparison: '>=', unit: '%' }],
        ANATOMICAL_LOCATION: ['scalp', 'face', 'hands', 'feet'],
        EXCLUSION_STRENGTH: 'inclusion',
        NESTED_CONDITION: {
          main_condition: { parameter: 'BSA', value: 10, comparison: '>=', unit: '%' },
          nested_operator: 'at_least_n',
          nested_count: 2,
          nested_items: [{ type: 'ANATOMICAL_LOCATION', values: ['scalp', 'face', 'hands', 'feet'] }],
          nested_logical_operator: 'OR'
        }
      },
      {
        id: 'SEV_1599',
        nct_id: 'NCT06672393',
        raw_text: 'PASI ≥ 12 with all of: scalp, nail, and joint involvement',
        MEASUREMENTS: [{ parameter: 'PASI', value: 12, comparison: '>=' }],
        ANATOMICAL_LOCATION: ['scalp', 'nails', 'joints'],
        EXCLUSION_STRENGTH: 'inclusion',
        NESTED_CONDITION: {
          main_condition: { parameter: 'PASI', value: 12, comparison: '>=' },
          nested_operator: 'all',
          nested_items: [{ type: 'ANATOMICAL_LOCATION', values: ['scalp', 'nails', 'joints'] }],
          nested_logical_operator: 'AND'
        }
      }
    ]
  }
});

describe('EXCEPTION_CONDITION Matching', () => {
  let matcher;
  let mockDB;

  beforeEach(() => {
    mockDB = createMockDatabase();
    matcher = new ClinicalTrialMatcher(mockDB);
  });

  describe('Cancer with Exceptions', () => {
    it('should EXCLUDE patient with cancer history (no exception applies)', async () => {
      const criterion = mockDB.CLUSTER_CMB.criteria[0]; // History of cancer except BCC
      const patientResponse = {
        CMB: [{ CONDITION_TYPE: ['lung cancer'], CONDITION_PATTERN: ['history'] }]
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'CMB');

      // Patient has lung cancer history → matches exclusion → should be excluded
      expect(result.matches).toBe(true);
      // When matches=true on exclusion criterion, patient is excluded
    });

    it('should make patient ELIGIBLE when exception applies (basal cell carcinoma)', async () => {
      const criterion = mockDB.CLUSTER_CMB.criteria[0]; // History of cancer except BCC
      const patientResponse = {
        CMB: [{ CONDITION_TYPE: ['basal cell carcinoma'], CONDITION_PATTERN: ['history'] }]
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'CMB');

      // Patient has BCC → exception applies → should NOT match exclusion
      // EXCEPTION_CONDITION.makes_eligible = true means exception overrides
      expect(result.matches).toBe(false); // Does NOT match exclusion
      expect(result.exceptionApplied).toBe(true);
      expect(result.confidenceReason.toLowerCase()).toContain('exception');
    });

    it('should handle multiple exception types (non-melanoma skin cancers)', async () => {
      const criterion = mockDB.CLUSTER_CMB.criteria[1]; // History of malignancy except NMSC
      const patientResponse = {
        CMB: [{ CONDITION_TYPE: ['squamous cell carcinoma'], CONDITION_PATTERN: ['history'] }]
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'CMB');

      // Squamous cell carcinoma is in excluded_types → exception applies
      expect(result.matches).toBe(false);
      expect(result.exceptionApplied).toBe(true);
    });

    it('should NOT apply exception if patient has different cancer type', async () => {
      const criterion = mockDB.CLUSTER_CMB.criteria[1]; // History of malignancy except NMSC
      const patientResponse = {
        // Use 'malignancy' directly to match the criterion's CONDITION_TYPE
        CMB: [{ CONDITION_TYPE: ['malignancy'], CONDITION_PATTERN: ['history'] }]
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'CMB');

      // 'malignancy' directly matches criterion but is NOT in excluded_types 
      // → no exception → matches exclusion → patient is excluded
      expect(result.matches).toBe(true);
      expect(result.exceptionApplied).toBeFalsy();
    });
  });
});

describe('NESTED_CONDITION Matching', () => {
  let matcher;
  let mockDB;

  beforeEach(() => {
    mockDB = createMockDatabase();
    matcher = new ClinicalTrialMatcher(mockDB);
  });

  describe('at_least_one operator', () => {
    it('should match when PASI in range AND has facial involvement', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[0]; // PASI 10-12 with facial OR scalp
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 11 }],
          ANATOMICAL_LOCATION: ['facial']
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(true);
      expect(result.nestedConditionMet).toBe(true);
    });

    it('should match when PASI in range AND has scalp involvement', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[0];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 10 }],
          ANATOMICAL_LOCATION: ['scalp']
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(true);
    });

    it('should NOT match when PASI in range but NO facial/scalp involvement', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[0];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 11 }],
          ANATOMICAL_LOCATION: ['hands', 'feet'] // Neither facial nor scalp
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(false);
      expect(result.nestedConditionMet).toBe(false);
    });

    it('should NOT match when PASI out of range (main condition fails)', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[0];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 15 }], // Above range
          ANATOMICAL_LOCATION: ['facial', 'scalp']
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(false); // Main condition fails
    });
  });

  describe('at_least_n operator', () => {
    it('should match when BSA ≥ 10% AND has 2+ locations', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[1]; // BSA ≥ 10% with 2 of 4 locations
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'BSA', value: 15 }],
          ANATOMICAL_LOCATION: ['scalp', 'hands'] // 2 locations
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(true);
      expect(result.nestedConditionMet).toBe(true);
    });

    it('should match when BSA ≥ 10% AND has 3 locations (exceeds requirement)', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[1];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'BSA', value: 12 }],
          ANATOMICAL_LOCATION: ['scalp', 'face', 'hands'] // 3 locations
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(true);
    });

    it('should NOT match when BSA ≥ 10% BUT has only 1 location', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[1];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'BSA', value: 15 }],
          ANATOMICAL_LOCATION: ['scalp'] // Only 1 location
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(false);
      expect(result.nestedConditionMet).toBe(false);
    });
  });

  describe('all operator', () => {
    it('should match when PASI ≥ 12 AND has ALL 3 locations', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[2]; // PASI ≥ 12 with ALL of scalp, nails, joints
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 15 }],
          ANATOMICAL_LOCATION: ['scalp', 'nails', 'joints']
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(true);
      expect(result.nestedConditionMet).toBe(true);
    });

    it('should NOT match when PASI ≥ 12 BUT missing one location', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[2];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 15 }],
          ANATOMICAL_LOCATION: ['scalp', 'nails'] // Missing joints
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(false);
      expect(result.nestedConditionMet).toBe(false);
    });

    it('should NOT match when locations present BUT PASI below threshold', async () => {
      const criterion = mockDB.CLUSTER_SEV.criteria[2];
      const patientResponse = {
        SEV: {
          MEASUREMENTS: [{ parameter: 'PASI', value: 10 }], // Below 12
          ANATOMICAL_LOCATION: ['scalp', 'nails', 'joints']
        }
      };

      const result = await matcher.evaluateCriterion(criterion, patientResponse, 'SEV');

      expect(result.matches).toBe(false); // Main condition fails
    });
  });
});
