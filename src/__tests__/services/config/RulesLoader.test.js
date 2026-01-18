/**
 * Tests for RulesLoader service
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDrugClasses,
  getDrugs,
  getDrugInfo,
  isKnownDrug,
  getDrugsByClass,
  getDrugClass,
  clearCache,
  getMetadata
} from '../../../services/config/RulesLoader.js';

describe('RulesLoader', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('getDrugClasses', () => {
    it('should return array of drug classes', () => {
      const classes = getDrugClasses();
      expect(Array.isArray(classes)).toBe(true);
      expect(classes.length).toBeGreaterThan(0);
    });

    it('should include standard drug classes', () => {
      const classes = getDrugClasses();
      expect(classes).toContain('TNF_inhibitors');
      expect(classes).toContain('IL17_inhibitors');
      expect(classes).toContain('IL23_inhibitors');
    });
  });

  describe('getDrugs', () => {
    it('should return object of drugs', () => {
      const drugs = getDrugs();
      expect(typeof drugs).toBe('object');
      expect(Object.keys(drugs).length).toBeGreaterThan(0);
    });

    it('should include common drugs', () => {
      const drugs = getDrugs();
      expect(drugs).toHaveProperty('humira');
      expect(drugs).toHaveProperty('enbrel');
      expect(drugs).toHaveProperty('cosentyx');
    });
  });

  describe('getDrugInfo', () => {
    it('should return info for known drug', () => {
      const info = getDrugInfo('humira');
      expect(info).not.toBeNull();
      expect(info.drugClass).toBe('TNF_inhibitors');
      expect(info.isBiologic).toBe(true);
    });

    it('should return null for unknown drug', () => {
      const info = getDrugInfo('unknowndrug12345');
      expect(info).toBeNull();
    });

    it('should be case-insensitive', () => {
      const info1 = getDrugInfo('HUMIRA');
      const info2 = getDrugInfo('humira');
      expect(info1).toEqual(info2);
    });

    it('should handle null input', () => {
      const info = getDrugInfo(null);
      expect(info).toBeNull();
    });
  });

  describe('isKnownDrug', () => {
    it('should return true for known drug', () => {
      expect(isKnownDrug('humira')).toBe(true);
      expect(isKnownDrug('enbrel')).toBe(true);
    });

    it('should return false for unknown drug', () => {
      expect(isKnownDrug('unknowndrug12345')).toBe(false);
    });

    it('should find drugs by alias', () => {
      expect(isKnownDrug('adalimumab')).toBe(true); // alias of humira
    });

    it('should be case-insensitive', () => {
      expect(isKnownDrug('HUMIRA')).toBe(true);
      expect(isKnownDrug('Humira')).toBe(true);
    });
  });

  describe('getDrugsByClass', () => {
    it('should return drugs in specified class', () => {
      const tnfDrugs = getDrugsByClass('TNF_inhibitors');
      expect(Array.isArray(tnfDrugs)).toBe(true);
      expect(tnfDrugs.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown class', () => {
      const drugs = getDrugsByClass('NonexistentClass');
      expect(drugs).toEqual([]);
    });
  });

  describe('getDrugClass', () => {
    it('should return drug class for known drug', () => {
      const drugClass = getDrugClass('humira');
      expect(drugClass).toBe('TNF_inhibitors');
    });

    it('should return null for unknown drug', () => {
      const drugClass = getDrugClass('unknowndrug12345');
      expect(drugClass).toBeNull();
    });
  });

  describe('getMetadata', () => {
    it('should return metadata object', () => {
      const meta = getMetadata();
      expect(typeof meta).toBe('object');
      expect(meta).toHaveProperty('version');
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', () => {
      // Load data first
      getDrugClasses();
      getDrugs();
      
      // Clear cache
      clearCache();
      
      // Data should still work after clearing
      const classes = getDrugClasses();
      expect(classes.length).toBeGreaterThan(0);
    });
  });
});
