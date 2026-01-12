import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClinicalTrialMatcher } from '../../services/matcher/ClinicalTrialMatcher.js';

// Mock database for testing
const mockDatabase = {
  metadata: {
    version: '2.0',
    totalCriteria: 5,
  },
  CLUSTER_AGE: {
    cluster_code: 'AGE',
    criteria: [
      {
        id: 'AGE_001',
        nct_id: 'NCT001',
        raw_text: 'Age 18-65 years',
        AGE_MIN: 18,
        AGE_MAX: 65,
        EXCLUSION_STRENGTH: 'inclusion',
      },
      {
        id: 'AGE_002',
        nct_id: 'NCT002',
        raw_text: 'Age 21-50 years',
        AGE_MIN: 21,
        AGE_MAX: 50,
        EXCLUSION_STRENGTH: 'inclusion',
      },
    ],
  },
  CLUSTER_BMI: {
    cluster_code: 'BMI',
    criteria: [
      {
        id: 'BMI_001',
        nct_id: 'NCT001',
        raw_text: 'BMI >= 18.5',
        BMI_MIN: 18.5,
        BMI_MAX: 35,
        EXCLUSION_STRENGTH: 'inclusion',
      },
    ],
  },
  CLUSTER_CMB: {
    cluster_code: 'CMB',
    criteria: [
      {
        id: 'CMB_001',
        nct_id: 'NCT001',
        raw_text: 'No active cancer',
        conditions: [
          {
            CONDITION_TYPE: ['cancer', 'malignancy'],
            SEVERITY: 'any',
          },
        ],
        EXCLUSION_STRENGTH: 'exclusion',
      },
    ],
  },
  CLUSTER_PTH: {
    cluster_code: 'PTH',
    criteria: [
      {
        id: 'PTH_001',
        nct_id: 'NCT001',
        raw_text: 'Prior TNF inhibitor use',
        conditions: [
          {
            TREATMENT_TYPE: ['tnf inhibitor', 'humira', 'enbrel'],
          },
        ],
        EXCLUSION_STRENGTH: 'exclusion',
      },
    ],
  },
};

describe('ClinicalTrialMatcher', () => {
  let matcher;

  beforeEach(() => {
    matcher = new ClinicalTrialMatcher(mockDatabase);
  });

  describe('constructor', () => {
    it('should create matcher without AI config', () => {
      expect(matcher).toBeDefined();
    });

    it('should create matcher with AI config', () => {
      const matcherWithAI = new ClinicalTrialMatcher(mockDatabase, {
        apiKey: 'test-key',
        model: 'claude-sonnet-4-5-20250929',
      });
      expect(matcherWithAI).toBeDefined();
    });
  });

  describe('getAllTrialIds', () => {
    it('should return all unique trial IDs', () => {
      const trialIds = matcher.getAllTrialIds();
      expect(trialIds.size).toBe(2);
      expect(trialIds.has('NCT001')).toBe(true);
      expect(trialIds.has('NCT002')).toBe(true);
    });
  });

  describe('evaluateTrial', () => {
    it('should return eligible for matching patient', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
        },
      };

      const result = await matcher.evaluateTrial('NCT001', patientResponse);

      expect(result.status).toBe('eligible');
      expect(result.nctId).toBe('NCT001');
    });

    it('should return ineligible when patient fails age inclusion', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 16 }, // Below minimum age 18
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
        },
      };

      const result = await matcher.evaluateTrial('NCT001', patientResponse);

      expect(result.status).toBe('ineligible');
      expect(result.failureReasons.length).toBeGreaterThan(0);
    });

    it('should return ineligible when patient matches exclusion criterion', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [
            {
              CONDITION_TYPE: ['cancer'],
              SEVERITY: 'moderate',
            },
          ],
          PTH: [],
        },
      };

      const result = await matcher.evaluateTrial('NCT001', patientResponse);

      expect(result.status).toBe('ineligible');
    });

    it('should handle treatment history exclusion', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['humira'],
            },
          ],
        },
      };

      const result = await matcher.evaluateTrial('NCT001', patientResponse);

      expect(result.status).toBe('ineligible');
    });
  });

  describe('matchPatient', () => {
    it('should evaluate all trials', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
        },
      };

      const results = await matcher.matchPatient(patientResponse);

      expect(results.getTotalTrialsEvaluated()).toBe(2);
    });

    it('should categorize results correctly', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
        },
      };

      const results = await matcher.matchPatient(patientResponse);

      expect(results.eligibleTrials.length + 
             results.ineligibleTrials.length + 
             results.needsReviewTrials.length).toBe(2);
    });

    it('should sort eligible trials by confidence', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
        },
      };

      const results = await matcher.matchPatient(patientResponse);

      if (results.eligibleTrials.length > 1) {
        const confidences = results.eligibleTrials.map((t) => t.getConfidenceScore());
        for (let i = 1; i < confidences.length; i++) {
          expect(confidences[i - 1]).toBeGreaterThanOrEqual(confidences[i]);
        }
      }
    });
  });

  describe('evaluateCriterion', () => {
    it('should evaluate age criterion correctly', async () => {
      const criterion = mockDatabase.CLUSTER_AGE.criteria[0];
      const patientResponse = {
        responses: {
          AGE: { age: 25 },
        },
      };

      const result = await matcher.evaluateCriterion(
        criterion,
        patientResponse,
        'AGE'
      );

      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should fail age criterion when outside range', async () => {
      const criterion = mockDatabase.CLUSTER_AGE.criteria[0];
      const patientResponse = {
        responses: {
          AGE: { age: 70 }, // Above max age 65
        },
      };

      const result = await matcher.evaluateCriterion(
        criterion,
        patientResponse,
        'AGE'
      );

      expect(result.matches).toBe(false);
    });

    it('should handle missing patient data gracefully', async () => {
      const criterion = mockDatabase.CLUSTER_AGE.criteria[0];
      const patientResponse = {
        responses: {},
      };

      const result = await matcher.evaluateCriterion(
        criterion,
        patientResponse,
        'AGE'
      );

      expect(result.matches).toBe(false);
      expect(result.confidence).toBeLessThan(1.0);
    });
  });
});
