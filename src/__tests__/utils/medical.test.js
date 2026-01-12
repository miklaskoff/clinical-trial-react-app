import { describe, it, expect } from 'vitest';
import {
  convertToWeeks,
  timeframeMatches,
  severityMatches,
  measurementMeetsThreshold,
  calculateBMI,
  SEVERITY_LEVELS,
} from '../../utils/medical.js';

describe('Medical Utils', () => {
  describe('convertToWeeks', () => {
    it('should convert days to weeks', () => {
      expect(convertToWeeks({ amount: 14, unit: 'days' })).toBeCloseTo(2, 1);
    });

    it('should keep weeks as weeks', () => {
      expect(convertToWeeks({ amount: 4, unit: 'weeks' })).toBe(4);
    });

    it('should convert months to weeks', () => {
      expect(convertToWeeks({ amount: 1, unit: 'months' })).toBeCloseTo(4.33, 1);
    });

    it('should convert years to weeks', () => {
      expect(convertToWeeks({ amount: 1, unit: 'years' })).toBe(52);
    });

    it('should return 0 for null/undefined', () => {
      expect(convertToWeeks(null)).toBe(0);
      expect(convertToWeeks({})).toBe(0);
    });
  });

  describe('timeframeMatches', () => {
    it('should match when no timeframe specified', () => {
      expect(timeframeMatches(null, null)).toBe(true);
      expect(timeframeMatches(null, { amount: 2, unit: 'weeks' })).toBe(true);
    });

    it('should not match when patient timeframe missing but required', () => {
      expect(timeframeMatches({ amount: 2, unit: 'weeks', relation: 'within' }, null)).toBe(false);
    });

    it('should match "within" relation correctly', () => {
      const criterion = { amount: 4, unit: 'weeks', relation: 'within' };
      expect(timeframeMatches(criterion, { amount: 2, unit: 'weeks' })).toBe(true);
      expect(timeframeMatches(criterion, { amount: 6, unit: 'weeks' })).toBe(false);
    });

    it('should match "after" relation correctly', () => {
      const criterion = { amount: 4, unit: 'weeks', relation: 'after' };
      expect(timeframeMatches(criterion, { amount: 6, unit: 'weeks' })).toBe(true);
      expect(timeframeMatches(criterion, { amount: 2, unit: 'weeks' })).toBe(false);
    });
  });

  describe('severityMatches', () => {
    it('should return true when no severity specified', () => {
      expect(severityMatches(null, 'moderate')).toBe(true);
      expect(severityMatches('none_specified', 'moderate')).toBe(true);
    });

    it('should return false when patient severity not provided', () => {
      expect(severityMatches('moderate', null)).toBe(false);
      expect(severityMatches('moderate', 'none_specified')).toBe(false);
    });

    it('should match when patient severity >= criterion severity', () => {
      expect(severityMatches('moderate', 'severe')).toBe(true);
      expect(severityMatches('moderate', 'moderate')).toBe(true);
    });

    it('should not match when patient severity < criterion severity', () => {
      expect(severityMatches('severe', 'mild')).toBe(false);
    });
  });

  describe('measurementMeetsThreshold', () => {
    it('should return true when no threshold specified', () => {
      expect(measurementMeetsThreshold(50, null, '>=')).toBe(true);
    });

    it('should return false when patient value not provided', () => {
      expect(measurementMeetsThreshold(null, 50, '>=')).toBe(false);
    });

    it('should compare >= correctly', () => {
      expect(measurementMeetsThreshold(50, 50, '>=')).toBe(true);
      expect(measurementMeetsThreshold(60, 50, '>=')).toBe(true);
      expect(measurementMeetsThreshold(40, 50, '>=')).toBe(false);
    });

    it('should compare < correctly', () => {
      expect(measurementMeetsThreshold(40, 50, '<')).toBe(true);
      expect(measurementMeetsThreshold(60, 50, '<')).toBe(false);
    });

    it('should compare = correctly with tolerance', () => {
      expect(measurementMeetsThreshold(50, 50, '=')).toBe(true);
      expect(measurementMeetsThreshold(50.005, 50, '=')).toBe(true);
      expect(measurementMeetsThreshold(51, 50, '=')).toBe(false);
    });
  });

  describe('calculateBMI', () => {
    it('should calculate BMI correctly with kg and cm', () => {
      // 70kg, 175cm = 70 / (1.75^2) = 22.86
      expect(calculateBMI(70, 175, 'kg', 'cm')).toBeCloseTo(22.86, 1);
    });

    it('should calculate BMI correctly with lb and in', () => {
      // 154lb (69.85kg), 69in (175.26cm) = 22.73
      expect(calculateBMI(154, 69, 'lb', 'in')).toBeCloseTo(22.73, 0);
    });

    it('should return 0 for invalid input', () => {
      expect(calculateBMI(null, 175)).toBe(0);
      expect(calculateBMI(70, null)).toBe(0);
      expect(calculateBMI(70, 0)).toBe(0);
    });
  });

  describe('SEVERITY_LEVELS', () => {
    it('should have correct severity hierarchy', () => {
      expect(SEVERITY_LEVELS.mild).toBeLessThan(SEVERITY_LEVELS.moderate);
      expect(SEVERITY_LEVELS.moderate).toBeLessThan(SEVERITY_LEVELS.severe);
      expect(SEVERITY_LEVELS.severe).toBeLessThan(SEVERITY_LEVELS.serious);
    });
  });
});
