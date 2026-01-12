/**
 * Medical-specific utilities
 * @module utils/medical
 */

import { normalizeString } from './string.js';

/**
 * Severity level hierarchy (higher = more severe)
 */
export const SEVERITY_LEVELS = {
  mild: 1,
  moderate: 2,
  'moderate-to-severe': 2.5,
  severe: 3,
  significant: 3,
  serious: 4,
  major: 4,
};

/**
 * Convert timeframe to weeks for standardized comparison
 * @param {Object} timeframe - Timeframe object
 * @param {number} timeframe.amount - Amount of time
 * @param {string} timeframe.unit - Time unit (days, weeks, months, years)
 * @returns {number} Duration in weeks
 */
export function convertToWeeks(timeframe) {
  if (!timeframe || timeframe.amount === null || timeframe.amount === undefined) {
    return 0;
  }

  const amount = parseFloat(timeframe.amount);
  const unit = (timeframe.unit || 'weeks').toLowerCase();

  const conversions = {
    days: amount / 7,
    day: amount / 7,
    weeks: amount,
    week: amount,
    months: amount * 4.33,
    month: amount * 4.33,
    years: amount * 52,
    year: amount * 52,
  };

  return conversions[unit] ?? amount;
}

/**
 * Check if patient's timeframe matches criterion's timeframe requirement
 * @param {Object} criterionTimeframe - Required timeframe from criterion
 * @param {Object} patientTimeframe - Patient's actual timeframe
 * @returns {boolean} True if timeframe matches
 */
export function timeframeMatches(criterionTimeframe, patientTimeframe) {
  if (!criterionTimeframe && !patientTimeframe) {
    return true;
  }
  if (!criterionTimeframe) {
    return true; // No restriction
  }
  if (!patientTimeframe) {
    return false; // Patient didn't provide required timeframe
  }

  const criterionWeeks = convertToWeeks(criterionTimeframe);
  const patientWeeks = convertToWeeks(patientTimeframe);

  switch (criterionTimeframe.relation) {
    case 'within':
      return patientWeeks <= criterionWeeks;
    case 'after':
      return patientWeeks >= criterionWeeks;
    case 'before':
      return patientWeeks <= criterionWeeks;
    case 'for':
      return patientWeeks >= criterionWeeks;
    default:
      return false;
  }
}

/**
 * Check if patient's severity matches criterion's severity requirement
 * @param {string} criterionSeverity - Required severity from criterion
 * @param {string} patientSeverity - Patient's actual severity
 * @returns {boolean} True if severity matches (patient >= criterion)
 */
export function severityMatches(criterionSeverity, patientSeverity) {
  if (!criterionSeverity || criterionSeverity === 'none_specified') {
    return true;
  }
  if (!patientSeverity || patientSeverity === 'none_specified') {
    return false;
  }

  const criterionLevel = SEVERITY_LEVELS[normalizeString(criterionSeverity)] ?? 2;
  const patientLevel = SEVERITY_LEVELS[normalizeString(patientSeverity)] ?? 2;

  return patientLevel >= criterionLevel;
}

/**
 * Check if measurement meets threshold
 * @param {number} patientValue - Patient's measurement value
 * @param {number} threshold - Criterion threshold
 * @param {string} comparison - Comparison operator (>=, >, <=, <, =)
 * @returns {boolean} True if measurement meets threshold
 */
export function measurementMeetsThreshold(patientValue, threshold, comparison) {
  if (threshold === null || threshold === undefined) {
    return true;
  }
  if (patientValue === null || patientValue === undefined) {
    return false;
  }

  const value = parseFloat(patientValue);
  const thresh = parseFloat(threshold);

  const comparisons = {
    '>=': value >= thresh,
    '>': value > thresh,
    '<=': value <= thresh,
    '<': value < thresh,
    '=': Math.abs(value - thresh) < 0.01,
    '==': Math.abs(value - thresh) < 0.01,
  };

  return comparisons[comparison] ?? false;
}

/**
 * Calculate BMI from weight and height
 * @param {number} weight - Weight value
 * @param {number} height - Height value
 * @param {string} [weightUnit='kg'] - Weight unit (kg or lb)
 * @param {string} [heightUnit='cm'] - Height unit (cm or in)
 * @returns {number} BMI value
 */
export function calculateBMI(weight, height, weightUnit = 'kg', heightUnit = 'cm') {
  if (!weight || !height) {
    return 0;
  }

  const weightKg = weightUnit === 'lb' ? weight * 0.453592 : weight;
  const heightM = heightUnit === 'in' ? height * 0.0254 : height / 100;

  if (heightM <= 0) {
    return 0;
  }

  return parseFloat((weightKg / (heightM * heightM)).toFixed(2));
}
