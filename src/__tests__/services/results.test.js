import { describe, it, expect, beforeEach } from 'vitest';
import {
  CriterionMatchResult,
  TrialEligibilityResult,
  PatientMatchResults,
} from '../../services/matcher/results.js';

describe('Result Classes', () => {
  describe('CriterionMatchResult', () => {
    it('should create result with default values', () => {
      const result = new CriterionMatchResult({
        criterionId: 'AGE_001',
        nctId: 'NCT123',
        matches: true,
      });

      expect(result.criterionId).toBe('AGE_001');
      expect(result.nctId).toBe('NCT123');
      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.exclusionStrength).toBe('exclusion');
    });

    it('should clamp confidence to 0-1 range', () => {
      const result1 = new CriterionMatchResult({
        criterionId: 'TEST',
        nctId: 'NCT123',
        matches: true,
        confidence: 1.5,
      });
      expect(result1.confidence).toBe(1.0);

      const result2 = new CriterionMatchResult({
        criterionId: 'TEST',
        nctId: 'NCT123',
        matches: true,
        confidence: -0.5,
      });
      expect(result2.confidence).toBe(0);
    });

    describe('causesIneligibility', () => {
      it('should return true for matched exclusion', () => {
        const result = new CriterionMatchResult({
          criterionId: 'CMB_001',
          nctId: 'NCT123',
          matches: true,
          exclusionStrength: 'exclusion',
        });
        expect(result.causesIneligibility()).toBe(true);
      });

      it('should return false for unmatched exclusion', () => {
        const result = new CriterionMatchResult({
          criterionId: 'CMB_001',
          nctId: 'NCT123',
          matches: false,
          exclusionStrength: 'exclusion',
        });
        expect(result.causesIneligibility()).toBe(false);
      });

      it('should return true for failed inclusion', () => {
        const result = new CriterionMatchResult({
          criterionId: 'AGE_001',
          nctId: 'NCT123',
          matches: false,
          exclusionStrength: 'inclusion',
        });
        expect(result.causesIneligibility()).toBe(true);
      });

      it('should return false for met inclusion', () => {
        const result = new CriterionMatchResult({
          criterionId: 'AGE_001',
          nctId: 'NCT123',
          matches: true,
          exclusionStrength: 'inclusion',
        });
        expect(result.causesIneligibility()).toBe(false);
      });
    });

    it('should convert to JSON', () => {
      const result = new CriterionMatchResult({
        criterionId: 'AGE_001',
        nctId: 'NCT123',
        matches: true,
        confidence: 0.95,
      });

      const json = result.toJSON();
      expect(json).toHaveProperty('criterionId', 'AGE_001');
      expect(json).toHaveProperty('causesIneligibility');
    });
  });

  describe('TrialEligibilityResult', () => {
    let eligibleCriteria;
    let ineligibleCriteria;

    beforeEach(() => {
      eligibleCriteria = [
        new CriterionMatchResult({
          criterionId: 'AGE_001',
          nctId: 'NCT123',
          matches: true,
          exclusionStrength: 'inclusion',
          confidence: 1.0,
        }),
        new CriterionMatchResult({
          criterionId: 'CMB_001',
          nctId: 'NCT123',
          matches: false,
          exclusionStrength: 'exclusion',
          confidence: 0.9,
        }),
      ];

      ineligibleCriteria = [
        new CriterionMatchResult({
          criterionId: 'AGE_001',
          nctId: 'NCT123',
          matches: false,
          exclusionStrength: 'inclusion',
          confidence: 1.0,
        }),
      ];
    });

    it('should calculate confidence score correctly', () => {
      const result = new TrialEligibilityResult({
        nctId: 'NCT123',
        status: 'eligible',
        matchedCriteria: eligibleCriteria,
      });

      expect(result.getConfidenceScore()).toBeCloseTo(0.95, 2);
    });

    it('should return 1.0 for empty criteria', () => {
      const result = new TrialEligibilityResult({
        nctId: 'NCT123',
        status: 'eligible',
        matchedCriteria: [],
      });

      expect(result.getConfidenceScore()).toBe(1.0);
    });

    it('should get ineligibility criteria', () => {
      const result = new TrialEligibilityResult({
        nctId: 'NCT123',
        status: 'ineligible',
        matchedCriteria: ineligibleCriteria,
      });

      const ineligible = result.getIneligibilityCriteria();
      expect(ineligible).toHaveLength(1);
      expect(ineligible[0].criterionId).toBe('AGE_001');
    });

    it('should convert to JSON', () => {
      const result = new TrialEligibilityResult({
        nctId: 'NCT123',
        status: 'eligible',
        matchedCriteria: eligibleCriteria,
      });

      const json = result.toJSON();
      expect(json).toHaveProperty('nctId', 'NCT123');
      expect(json).toHaveProperty('status', 'eligible');
      expect(json).toHaveProperty('confidence');
    });
  });

  describe('PatientMatchResults', () => {
    it('should calculate total trials evaluated', () => {
      const results = new PatientMatchResults({
        patientResponse: {},
        eligibleTrials: [
          new TrialEligibilityResult({ nctId: 'NCT1', status: 'eligible', matchedCriteria: [] }),
          new TrialEligibilityResult({ nctId: 'NCT2', status: 'eligible', matchedCriteria: [] }),
        ],
        ineligibleTrials: [
          new TrialEligibilityResult({ nctId: 'NCT3', status: 'ineligible', matchedCriteria: [] }),
        ],
        needsReviewTrials: [],
      });

      expect(results.getTotalTrialsEvaluated()).toBe(3);
    });

    it('should generate summary', () => {
      const results = new PatientMatchResults({
        patientResponse: {},
        eligibleTrials: [
          new TrialEligibilityResult({ nctId: 'NCT1', status: 'eligible', matchedCriteria: [] }),
        ],
        ineligibleTrials: [
          new TrialEligibilityResult({ nctId: 'NCT2', status: 'ineligible', matchedCriteria: [] }),
          new TrialEligibilityResult({ nctId: 'NCT3', status: 'ineligible', matchedCriteria: [] }),
        ],
        needsReviewTrials: [],
      });

      const summary = results.getSummary();
      expect(summary.totalEvaluated).toBe(3);
      expect(summary.eligible).toBe(1);
      expect(summary.ineligible).toBe(2);
      expect(parseFloat(summary.eligibilityRate)).toBeCloseTo(33.3, 0);
    });

    it('should convert to JSON', () => {
      const results = new PatientMatchResults({
        patientResponse: { AGE: { age: 25 } },
        eligibleTrials: [],
        ineligibleTrials: [],
        needsReviewTrials: [],
      });

      const json = results.toJSON();
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('summary');
      expect(json).toHaveProperty('eligibleTrials');
    });
  });
});
