import { describe, it, expect, beforeEach } from 'vitest';
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
      {
        id: 'PTH_002',
        nct_id: 'NCT003',
        raw_text: 'Previous participation in a piclidenoson (CF101) clinical trial',
        conditions: [
          {
            TREATMENT_TYPE: ['piclidenoson', 'CF101'],
            TREATMENT_PATTERN: ['previous participation'],
          },
        ],
        EXCLUSION_STRENGTH: 'mandatory_exclude',
      },
      {
        id: 'PTH_003',
        nct_id: 'NCT004',
        raw_text: 'Prior use of experimental drug XYZ-999',
        conditions: [
          {
            TREATMENT_TYPE: ['XYZ-999', 'experimental-xyz'],
          },
        ],
        EXCLUSION_STRENGTH: 'mandatory_exclude',
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
      expect(trialIds.size).toBe(4);
      expect(trialIds.has('NCT001')).toBe(true);
      expect(trialIds.has('NCT002')).toBe(true);
      expect(trialIds.has('NCT003')).toBe(true);
      expect(trialIds.has('NCT004')).toBe(true);
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

      expect(results.getTotalTrialsEvaluated()).toBe(4);
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
             results.needsReviewTrials.length).toBe(4);
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

  describe('Treatment History Matching - 3-Step Cascade', () => {
    it('should match piclidenoson via database lookup (known drug)', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['piclidenoson'],
            },
          ],
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      expect(result.status).toBe('ineligible');
      // piclidenoson is now in database, so needsAdminReview should be false
      const pthCriterion = result.matchedCriteria.find(r => r.criterionId === 'PTH_002');
      expect(pthCriterion).toBeDefined();
      expect(pthCriterion.matches).toBe(true);
      expect(pthCriterion.needsAdminReview).toBe(false);
    });

    it('should match CF101 (brand name of piclidenoson) via database', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['CF101'],
            },
          ],
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      expect(result.status).toBe('ineligible');
    });

    it('should match unknown drug via direct string match and flag for admin review', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['XYZ-999'], // Not in drug database, but in criterion
            },
          ],
        },
      };

      const result = await matcher.evaluateTrial('NCT004', patientResponse);

      expect(result.status).toBe('ineligible');
      const pthCriterion = result.matchedCriteria.find(r => r.criterionId === 'PTH_003');
      expect(pthCriterion).toBeDefined();
      expect(pthCriterion.matches).toBe(true);
      expect(pthCriterion.needsAdminReview).toBe(true);
      expect(pthCriterion.matchMethod).toBe('direct_unverified');
    });

    it('should include review payload for unknown drugs', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['experimental-xyz'],
            },
          ],
        },
      };

      const result = await matcher.evaluateTrial('NCT004', patientResponse);

      const pthCriterion = result.matchedCriteria.find(r => r.criterionId === 'PTH_003');
      expect(pthCriterion.reviewPayload).toBeDefined();
      expect(pthCriterion.reviewPayload.drugName).toBe('experimental-xyz');
      expect(pthCriterion.reviewPayload.criterionId).toBe('PTH_003');
      expect(pthCriterion.reviewPayload.nctId).toBe('NCT004');
    });

    it('should not match when drug is not in criterion and not in database', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['completely-unknown-drug-12345'],
            },
          ],
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      // Should not match PTH_002 because the drug is neither in DB nor in criterion
      const pthCriterion = result.matchedCriteria.find(r => r.criterionId === 'PTH_002');
      expect(pthCriterion.matches).toBe(false);
    });
  });
});
