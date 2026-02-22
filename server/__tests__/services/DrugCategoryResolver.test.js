/**
 * @file DrugCategoryResolver Tests
 * @description Tests for drug classification and generic search term generation
 */

import { describe, it, expect } from 'vitest';
import { 
  resolveDrugCategory, 
  getClassSearchTerms,
  getGenericSearchTerms,
  DRUG_DATABASE
} from '../../services/DrugCategoryResolver.js';

describe('DrugCategoryResolver', () => {
  describe('resolveDrugCategory', () => {
    it('should resolve adalimumab to TNF_inhibitors', () => {
      const result = resolveDrugCategory('adalimumab');
      expect(result.drugClass).toBe('TNF_inhibitors');
      expect(result.isBiologic).toBe(true);
      expect(result.found).toBe(true);
    });

    it('should resolve secukinumab to IL17_inhibitors', () => {
      const result = resolveDrugCategory('secukinumab');
      expect(result.drugClass).toBe('IL17_inhibitors');
      expect(result.isBiologic).toBe(true);
    });

    it('should resolve methotrexate to systemic_immunosuppressants', () => {
      const result = resolveDrugCategory('methotrexate');
      expect(result.drugClass).toBe('systemic_immunosuppressants');
      expect(result.isBiologic).toBe(false);
    });
  });

  describe('getClassSearchTerms', () => {
    it('should return TNF-related terms for TNF_inhibitors', () => {
      const terms = getClassSearchTerms('TNF_inhibitors');
      expect(terms).toContain('TNF');
      expect(terms).toContain('anti-TNF');
      expect(terms).toContain('adalimumab');
    });

    it('should return IL-17 terms for IL17_inhibitors', () => {
      const terms = getClassSearchTerms('IL17_inhibitors');
      expect(terms).toContain('IL-17');
      expect(terms).toContain('secukinumab');
    });
  });

  describe('getGenericSearchTerms', () => {
    it('should return biologic terms for adalimumab (TNF inhibitor biologic)', () => {
      const drugInfo = resolveDrugCategory('adalimumab');
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).toContain('biologic');
      expect(terms).toContain('biologic agent');
      expect(terms).toContain('biological therapy');
      expect(terms).toContain('monoclonal antibody');
    });

    it('should return DMARD terms for adalimumab (biologic DMARD)', () => {
      const drugInfo = resolveDrugCategory('adalimumab');
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).toContain('bDMARD');
      expect(terms).toContain('DMARD');
    });

    it('should return biologic terms for secukinumab (IL-17 inhibitor)', () => {
      const drugInfo = resolveDrugCategory('secukinumab');
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).toContain('biologic');
      expect(terms).toContain('monoclonal antibody');
      expect(terms).toContain('bDMARD');
    });

    it('should return immunosuppressive terms for methotrexate', () => {
      const drugInfo = resolveDrugCategory('methotrexate');
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).toContain('immunosuppressive');
      expect(terms).toContain('immunosuppressant');
      expect(terms).toContain('csDMARD');
    });

    it('should NOT return biologic terms for methotrexate (small molecule)', () => {
      const drugInfo = resolveDrugCategory('methotrexate');
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).not.toContain('biologic');
      expect(terms).not.toContain('monoclonal antibody');
    });

    it('should return small molecule terms for apremilast (PDE4 inhibitor)', () => {
      const drugInfo = resolveDrugCategory('apremilast');
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).toContain('small molecule');
      expect(terms).not.toContain('biologic');
    });

    it('should return empty array for unknown drugs', () => {
      const drugInfo = { drugClass: 'unknown', drugType: 'unknown', isBiologic: false, found: false };
      const terms = getGenericSearchTerms(drugInfo);
      
      expect(terms).toEqual([]);
    });
  });
});
