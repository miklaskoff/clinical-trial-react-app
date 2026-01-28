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
  CLUSTER_CPD: {
    cluster_code: 'CPD',
    criteria: [
      {
        id: 'CPD_001',
        nct_id: 'NCT001',
        raw_text: 'Duration of psoriasis of at least 12 months',
        TIMEFRAME: {
          relation: 'at least',
          amount: 12,
          unit: 'months',
          reference: 'diagnosis',
        },
        EXCLUSION_STRENGTH: 'inclusion',
      },
      {
        id: 'CPD_002',
        nct_id: 'NCT003',
        raw_text: 'Psoriasis for at least 6 months',
        TIMEFRAME: {
          relation: 'at least',
          amount: 6,
          unit: 'months',
          reference: 'diagnosis',
        },
        EXCLUSION_STRENGTH: 'inclusion',
      },
      {
        id: 'CPD_003',
        nct_id: 'NCT005',
        raw_text: 'Psoriasis for at least 2 years',
        DURATION_MIN: 2,
        DURATION_UNIT: 'years',
        EXCLUSION_STRENGTH: 'inclusion',
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
      expect(trialIds.size).toBe(5);
      expect(trialIds.has('NCT001')).toBe(true);
      expect(trialIds.has('NCT002')).toBe(true);
      expect(trialIds.has('NCT003')).toBe(true);
      expect(trialIds.has('NCT004')).toBe(true);
      expect(trialIds.has('NCT005')).toBe(true);
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
          CPD: { duration: 3, unit: 'years' },
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
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const results = await matcher.matchPatient(patientResponse);

      expect(results.getTotalTrialsEvaluated()).toBe(5);
    });

    it('should categorize results correctly', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const results = await matcher.matchPatient(patientResponse);

      expect(results.eligibleTrials.length + 
             results.ineligibleTrials.length + 
             results.needsReviewTrials.length).toBe(5);
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

  describe('evaluateDuration - CPD cluster', () => {
    it('should match when patient duration exceeds criterion TIMEFRAME requirement (years vs months)', async () => {
      // Patient has 3 years = 36 months, criterion requires 12 months
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const result = await matcher.evaluateTrial('NCT001', patientResponse);

      const cpdCriterion = result.matchedCriteria.find(r => r.criterionId === 'CPD_001');
      expect(cpdCriterion).toBeDefined();
      expect(cpdCriterion.matches).toBe(true);
      expect(cpdCriterion.confidence).toBe(1.0);
    });

    it('should match when patient duration in months exceeds criterion months', async () => {
      // Patient has 18 months, criterion requires 6 months
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
          CPD: { duration: 18, unit: 'months' },
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      const cpdCriterion = result.matchedCriteria.find(r => r.criterionId === 'CPD_002');
      expect(cpdCriterion).toBeDefined();
      expect(cpdCriterion.matches).toBe(true);
    });

    it('should NOT match when patient duration is less than criterion requirement', async () => {
      // Patient has 6 months, criterion requires 12 months
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
          CPD: { duration: 6, unit: 'months' },
        },
      };

      const result = await matcher.evaluateTrial('NCT001', patientResponse);

      const cpdCriterion = result.matchedCriteria.find(r => r.criterionId === 'CPD_001');
      expect(cpdCriterion).toBeDefined();
      expect(cpdCriterion.matches).toBe(false);
    });

    it('should support legacy DURATION_MIN/DURATION_UNIT format', async () => {
      // Patient has 3 years, criterion requires 2 years (uses DURATION_MIN format)
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [],
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const result = await matcher.evaluateTrial('NCT005', patientResponse);

      const cpdCriterion = result.matchedCriteria.find(r => r.criterionId === 'CPD_003');
      expect(cpdCriterion).toBeDefined();
      expect(cpdCriterion.matches).toBe(true);
    });
  });

  describe('piclidenoson matching - Bug fix verification', () => {
    it('should match piclidenoson when patient used piclidenoson (database match)', async () => {
      const patientResponse = {
        responses: {
          AGE: { age: 30 },
          BMI: { bmi: 24.5 },
          CMB: [],
          PTH: [
            {
              TREATMENT_TYPE: ['piclidenoson'],
              TREATMENT_PATTERN: ['used previously'],
            },
          ],
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      const pthCriterion = result.matchedCriteria.find(r => r.criterionId === 'PTH_002');
      expect(pthCriterion).toBeDefined();
      expect(pthCriterion.matches).toBe(true);
      expect(pthCriterion.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should match CF101 when patient used piclidenoson (synonym match)', async () => {
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
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      const pthCriterion = result.matchedCriteria.find(r => r.criterionId === 'PTH_002');
      expect(pthCriterion).toBeDefined();
      expect(pthCriterion.matches).toBe(true);
    });

    it('should correctly exclude patient who used piclidenoson from trial', async () => {
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
          CPD: { duration: 3, unit: 'years' },
        },
      };

      const result = await matcher.evaluateTrial('NCT003', patientResponse);

      // Status should be ineligible because piclidenoson matches exclusion
      expect(result.status).toBe('ineligible');
      expect(result.failureReasons.some(r => r.includes('piclidenoson'))).toBe(true);
    });
  });

  describe('Double-Negative Weight Parsing (Issue 2a)', () => {
    // Create matcher with criteria that have no slot-filled fields
    const matcherWithRawText = new ClinicalTrialMatcher({
      metadata: { version: '2.0', totalCriteria: 3 },
      CLUSTER_BMI: {
        cluster_code: 'BMI',
        criteria: [
          {
            id: 'BMI_1916',
            nct_id: 'NCT06979453',
            raw_text: 'Participants must not weigh < 30.0 kg at Screening and Day 1.',
            EXCLUSION_STRENGTH: 'mandatory_exclude',
            // NO WEIGHT_MIN or WEIGHT_MAX fields - must parse from raw_text
          },
          {
            id: 'BMI_TEST_18',
            nct_id: 'NCT04772079',
            raw_text: 'Participants weighing ≤ 18.0 kg at screening for Cohort 2.',
            EXCLUSION_STRENGTH: 'mandatory_exclude',
            // NO WEIGHT_MAX field - must parse from raw_text
          },
          {
            id: 'BMI_TEST_30',
            nct_id: 'NCT04772079',
            raw_text: 'Participants weighing ≤ 30.0 kg at screening for Cohort 1.',
            EXCLUSION_STRENGTH: 'mandatory_exclude',
            // NO WEIGHT_MAX field - must parse from raw_text
          },
        ],
      },
    });

    it('should parse double-negative "must not weigh < X" and invert logic for exclusion', async () => {
      // BMI_1916: "must not weigh < 30kg" in exclusion
      // Semantically: minimum weight 30kg (inclusion-like)
      // Patient 71kg SHOULD NOT be excluded
      const patientResponse = {
        responses: {
          BMI: { weight: 71, bmi: 24.57 },
        },
      };

      const result = await matcherWithRawText.evaluateTrial('NCT06979453', patientResponse);

      // Patient should NOT be excluded (status should be eligible or needs_review, not ineligible)
      expect(result.status).not.toBe('ineligible');
      
      // Check the specific criterion evaluation
      const bmiCriterion = result.matchedCriteria?.find(c => c.criterionId === 'BMI_1916');
      if (bmiCriterion) {
        // With inverted logic: patient meets requirement (71 >= 30) → matches = false for exclusion
        expect(bmiCriterion.matches).toBe(false);
        expect(bmiCriterion.confidenceReason).toContain('Double-negative');
      }
    });

    it('should parse simple "weighing ≤ X kg" pattern correctly', async () => {
      // BMI_TEST_18: "weighing ≤ 18kg" in exclusion
      // Patient 71kg SHOULD NOT match this (71 > 18)
      const patientResponse = {
        responses: {
          BMI: { weight: 71, bmi: 24.57 },
        },
      };

      const result = await matcherWithRawText.evaluateTrial('NCT04772079', patientResponse);

      // Patient should NOT be excluded by the 18kg criterion
      expect(result.status).not.toBe('ineligible');
    });

    it('should handle patient below threshold for simple comparison', async () => {
      // BMI_TEST_18: "weighing ≤ 18kg"
      // Patient 15kg SHOULD match exclusion (15 <= 18)
      const patientResponse = {
        responses: {
          BMI: { weight: 15, bmi: 14 },
        },
      };

      const result = await matcherWithRawText.evaluateTrial('NCT04772079', patientResponse);

      // Patient should be excluded (too light for the trial)
      expect(result.status).toBe('ineligible');
    });

    it('should handle patient at exact threshold for double-negative', async () => {
      // BMI_1916: "must not weigh < 30kg" → minimum 30kg
      // Patient exactly 30kg should NOT be excluded
      const patientResponse = {
        responses: {
          BMI: { weight: 30, bmi: 18.5 },
        },
      };

      const result = await matcherWithRawText.evaluateTrial('NCT06979453', patientResponse);

      // Patient at minimum threshold should NOT be excluded
      expect(result.status).not.toBe('ineligible');
    });

    it('should handle patient below threshold for double-negative', async () => {
      // BMI_1916: "must not weigh < 30kg" → minimum 30kg
      // Patient 25kg SHOULD be excluded (fails minimum requirement)
      const patientResponse = {
        responses: {
          BMI: { weight: 25, bmi: 16 },
        },
      };

      const result = await matcherWithRawText.evaluateTrial('NCT06979453', patientResponse);

      // Patient below minimum should be excluded
      expect(result.status).toBe('ineligible');
    });

    it('should provide clear reasoning for parsed criteria', async () => {
      const patientResponse = {
        responses: {
          BMI: { weight: 71, bmi: 24.57 },
        },
      };

      const result = await matcherWithRawText.evaluateTrial('NCT06979453', patientResponse);

      // Find the BMI criterion in matched criteria
      const bmiCriterion = result.matchedCriteria?.find(c => c.criterionId === 'BMI_1916') ||
                           result.failedCriteria?.find(c => c.criterionId === 'BMI_1916');
      
      if (bmiCriterion) {
        // Should mention double-negative and the threshold
        expect(bmiCriterion.confidenceReason).toMatch(/double-negative|inverted|30/i);
      }
    });
  });
});
