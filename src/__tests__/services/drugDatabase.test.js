import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDrugInfo,
  drugsMatch,
  drugBelongsToClass,
  findSynonyms,
  DRUG_DATABASE,
} from '../../services/matcher/drugDatabase.js';

describe('Drug Database', () => {
  describe('getDrugInfo', () => {
    it('should return drug info for known drugs', () => {
      const info = getDrugInfo('humira');
      expect(info).toBeDefined();
      expect(info.class).toBe('TNF inhibitor');
      expect(info.isBiologic).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(getDrugInfo('HUMIRA')).toBeDefined();
      expect(getDrugInfo('Humira')).toBeDefined();
    });

    it('should return null for unknown drugs', () => {
      expect(getDrugInfo('unknown-drug')).toBeNull();
      expect(getDrugInfo(null)).toBeNull();
    });
  });

  describe('drugsMatch', () => {
    it('should match same drug names', () => {
      expect(drugsMatch('humira', 'humira')).toBe(true);
      expect(drugsMatch('Humira', 'HUMIRA')).toBe(true);
    });

    it('should match brand and generic names', () => {
      expect(drugsMatch('humira', 'adalimumab')).toBe(true);
      expect(drugsMatch('adalimumab', 'humira')).toBe(true);
    });

    it('should not match different drugs', () => {
      expect(drugsMatch('humira', 'cosentyx')).toBe(false);
    });

    it('should handle unknown drugs gracefully', () => {
      expect(drugsMatch('unknown', 'unknown')).toBe(true);
      expect(drugsMatch('unknown', 'other')).toBe(false);
    });
  });

  describe('drugBelongsToClass', () => {
    it('should identify TNF inhibitors', () => {
      expect(drugBelongsToClass('humira', 'tnf')).toBe(true);
      expect(drugBelongsToClass('enbrel', 'TNF inhibitor')).toBe(true);
      expect(drugBelongsToClass('remicade', 'tnf')).toBe(true);
    });

    it('should identify IL-17 inhibitors', () => {
      expect(drugBelongsToClass('cosentyx', 'il-17')).toBe(true);
      expect(drugBelongsToClass('taltz', 'IL-17 inhibitor')).toBe(true);
    });

    it('should identify IL-23 inhibitors', () => {
      expect(drugBelongsToClass('skyrizi', 'il-23')).toBe(true);
      expect(drugBelongsToClass('tremfya', 'IL-23')).toBe(true);
    });

    it('should identify biologics', () => {
      expect(drugBelongsToClass('humira', 'biologic')).toBe(true);
      expect(drugBelongsToClass('cosentyx', 'biologic')).toBe(true);
    });

    it('should return false for non-matching classes', () => {
      expect(drugBelongsToClass('humira', 'il-17')).toBe(false);
      expect(drugBelongsToClass('methotrexate', 'biologic')).toBe(false);
    });

    it('should return false for unknown drugs', () => {
      expect(drugBelongsToClass('unknown', 'tnf')).toBe(false);
    });
  });

  describe('findSynonyms', () => {
    it('should find synonyms for known conditions', () => {
      const synonyms = findSynonyms('depression');
      expect(synonyms).toContain('depression');
      expect(synonyms).toContain('major depressive disorder');
      expect(synonyms).toContain('mdd');
    });

    it('should find reverse synonyms', () => {
      const synonyms = findSynonyms('mdd');
      expect(synonyms).toContain('depression');
    });

    it('should return array with original term for unknown terms', () => {
      const synonyms = findSynonyms('unknown');
      expect(synonyms).toEqual(['unknown']);
    });

    it('should handle null/empty input', () => {
      expect(findSynonyms(null)).toEqual([]);
      expect(findSynonyms('')).toEqual([]);
    });
  });
});
