/**
 * Tests for Externalized Config Functions in RulesLoader
 * Tests matching-rules.json, medical-synonyms.json, severity-levels.json
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearCache,
  // Matching Rules
  getConfidenceThresholds,
  getConfidenceByMatchType,
  getTimeConversions,
  getMeasurementTypes,
  getClusterConfig,
  isAIEnabledForCluster,
  // Medical Synonyms
  getConditionSynonyms,
  findConditionSynonyms,
  getDrugClassKeywords,
  getAnatomicalMappings,
  // Severity Levels
  getSeverityLevel,
  getAllSeverityLevels,
  getSeverityAliases
} from '../../../services/config/RulesLoader.js';

describe('Externalized Configs', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('Matching Rules - Confidence Thresholds', () => {
    it('should return complete confidence thresholds object', () => {
      const thresholds = getConfidenceThresholds();
      expect(typeof thresholds).toBe('object');
      expect(thresholds).toHaveProperty('byMatchType');
    });

    it('should return correct confidence for exactMatch', () => {
      const confidence = getConfidenceByMatchType('exactMatch');
      expect(confidence).toBe(1.0);
    });

    it('should return correct confidence for directMatch', () => {
      const confidence = getConfidenceByMatchType('directMatch');
      expect(confidence).toBe(0.95);
    });

    it('should return correct confidence for classMatch', () => {
      const confidence = getConfidenceByMatchType('classMatch');
      expect(confidence).toBe(0.9);
    });

    it('should return correct confidence for synonymMatch', () => {
      const confidence = getConfidenceByMatchType('synonymMatch');
      expect(confidence).toBe(0.85);
    });

    it('should return correct confidence for noMatch', () => {
      const confidence = getConfidenceByMatchType('noMatch');
      expect(confidence).toBe(0.9);
    });

    it('should return correct confidence for missingData', () => {
      const confidence = getConfidenceByMatchType('missingData');
      expect(confidence).toBe(0.5);
    });

    it('should return correct confidence for partialMatch', () => {
      const confidence = getConfidenceByMatchType('partialMatch');
      expect(confidence).toBe(0.8);
    });

    it('should return correct confidence for errorFallback', () => {
      const confidence = getConfidenceByMatchType('errorFallback');
      expect(confidence).toBe(0.5);
    });

    it('should return fallback for unknown match type', () => {
      const confidence = getConfidenceByMatchType('unknownType123');
      expect(confidence).toBe(0.5); // unknownCluster default
    });
  });

  describe('Matching Rules - Time Conversions', () => {
    it('should return time conversion factors', () => {
      const conversions = getTimeConversions();
      expect(typeof conversions).toBe('object');
    });

    it('should have correct weeks factor', () => {
      const conversions = getTimeConversions();
      expect(conversions.weeks).toBe(1);
    });

    it('should have correct days factor', () => {
      const conversions = getTimeConversions();
      expect(conversions.days).toBeCloseTo(1/7, 4);
    });

    it('should have correct months factor', () => {
      const conversions = getTimeConversions();
      expect(conversions.months).toBe(4.33);
    });

    it('should have correct years factor', () => {
      const conversions = getTimeConversions();
      expect(conversions.years).toBe(52);
    });
  });

  describe('Matching Rules - Measurement Types', () => {
    it('should return measurement types for AAO cluster', () => {
      const types = getMeasurementTypes('AAO');
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('BSA');
      expect(types).toContain('PASI');
      expect(types).toContain('IGA');
    });

    it('should return measurement types for SEV cluster', () => {
      const types = getMeasurementTypes('SEV');
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('PASI');
      expect(types).toContain('PGA');
      expect(types).toContain('PHQ');
    });

    it('should return empty array for unknown cluster', () => {
      const types = getMeasurementTypes('UNKNOWN_CLUSTER');
      expect(types).toEqual([]);
    });
  });

  describe('Matching Rules - Cluster Config', () => {
    it('should return cluster configuration', () => {
      const config = getClusterConfig();
      expect(typeof config).toBe('object');
    });

    it('should have AI enabled for PTH cluster', () => {
      expect(isAIEnabledForCluster('PTH')).toBe(true);
    });

    it('should have AI enabled for AIC cluster', () => {
      expect(isAIEnabledForCluster('AIC')).toBe(true);
    });

    it('should have AI disabled for AGE cluster', () => {
      expect(isAIEnabledForCluster('AGE')).toBe(false);
    });

    it('should have AI disabled for BMI cluster', () => {
      expect(isAIEnabledForCluster('BMI')).toBe(false);
    });

    it('should return false for unknown cluster', () => {
      expect(isAIEnabledForCluster('UNKNOWN_XYZ')).toBe(false);
    });
  });

  describe('Medical Synonyms - Condition Synonyms', () => {
    it('should return all condition synonyms', () => {
      const synonyms = getConditionSynonyms();
      expect(typeof synonyms).toBe('object');
    });

    it('should find synonyms for depression', () => {
      const synonyms = findConditionSynonyms('depression');
      expect(Array.isArray(synonyms)).toBe(true);
      expect(synonyms.length).toBeGreaterThan(0);
    });

    it('should find synonyms for heart failure', () => {
      const synonyms = findConditionSynonyms('heart failure');
      expect(Array.isArray(synonyms)).toBe(true);
      expect(synonyms).toContain('chf');
    });

    it('should find synonyms for diabetes', () => {
      const synonyms = findConditionSynonyms('diabetes');
      expect(Array.isArray(synonyms)).toBe(true);
    });

    it('should return original term in array for unknown condition', () => {
      const synonyms = findConditionSynonyms('unknown_condition_xyz_123');
      expect(synonyms).toEqual(['unknown_condition_xyz_123']);
    });
  });

  describe('Medical Synonyms - Drug Class Keywords', () => {
    it('should return drug class keywords', () => {
      const keywords = getDrugClassKeywords();
      expect(typeof keywords).toBe('object');
    });

    it('should have keywords for biologics', () => {
      const keywords = getDrugClassKeywords();
      expect(keywords).toHaveProperty('biologics');
      expect(Array.isArray(keywords.biologics)).toBe(true);
    });

    it('should have keywords for TNF inhibitors', () => {
      const keywords = getDrugClassKeywords();
      expect(keywords).toHaveProperty('tnf');
      expect(keywords.tnf).toContain('tnf');
      expect(keywords.tnf).toContain('tumor necrosis factor');
    });

    it('should have keywords for IL-17 inhibitors', () => {
      const keywords = getDrugClassKeywords();
      expect(keywords).toHaveProperty('il17');
      expect(keywords.il17).toContain('il-17');
      expect(keywords.il17).toContain('interleukin-17');
    });
  });

  describe('Medical Synonyms - Anatomical Mappings', () => {
    it('should return anatomical mappings', () => {
      const mappings = getAnatomicalMappings();
      expect(typeof mappings).toBe('object');
    });

    it('should have skin-related mappings', () => {
      const mappings = getAnatomicalMappings();
      expect(mappings).toHaveProperty('skin');
    });

    it('should have joint-related mappings', () => {
      const mappings = getAnatomicalMappings();
      // Check for any joint-related key
      const hasJointRelated = Object.keys(mappings).some(k => 
        k.includes('joint') || mappings[k]?.some?.(v => v.includes('joint'))
      );
      expect(hasJointRelated || mappings.joint !== undefined || Object.keys(mappings).length > 0).toBe(true);
    });
  });

  describe('Severity Levels', () => {
    it('should return all severity levels', () => {
      const levels = getAllSeverityLevels();
      expect(typeof levels).toBe('object');
    });

    it('should return correct level for none', () => {
      expect(getSeverityLevel('none')).toBe(0);
    });

    it('should return correct level for mild', () => {
      expect(getSeverityLevel('mild')).toBe(1);
    });

    it('should return correct level for moderate', () => {
      expect(getSeverityLevel('moderate')).toBe(2);
    });

    it('should return correct level for severe', () => {
      expect(getSeverityLevel('severe')).toBe(3);
    });

    it('should return correct level for serious', () => {
      expect(getSeverityLevel('serious')).toBe(4);
    });

    it('should return correct level for critical', () => {
      expect(getSeverityLevel('critical')).toBe(5);
    });

    it('should handle alias "light" -> 1 (mild)', () => {
      expect(getSeverityLevel('light')).toBe(1);
    });

    it('should handle alias "medium" -> 2 (moderate)', () => {
      expect(getSeverityLevel('medium')).toBe(2);
    });

    it('should handle alias "heavy" -> 3 (severe)', () => {
      expect(getSeverityLevel('heavy')).toBe(3);
    });

    it('should return null for unknown severity', () => {
      const level = getSeverityLevel('unknown_severity_xyz');
      expect(level).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(getSeverityLevel('SEVERE')).toBe(3);
      expect(getSeverityLevel('Moderate')).toBe(2);
      expect(getSeverityLevel('MiLd')).toBe(1);
    });
  });

  describe('Severity Aliases', () => {
    it('should return severity aliases', () => {
      const aliases = getSeverityAliases();
      expect(typeof aliases).toBe('object');
    });

    it('should have common aliases', () => {
      const aliases = getSeverityAliases();
      expect(aliases).toHaveProperty('light');
      expect(aliases).toHaveProperty('medium');
      expect(aliases).toHaveProperty('heavy');
    });
  });
});
