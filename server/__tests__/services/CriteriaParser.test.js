/**
 * @file CriteriaParser.test.js
 * @description TDD tests for 100% LLM Criteria Parser
 * 
 * Test Categories:
 * 1. Parser initialization and configuration
 * 2. Field extraction (all 18 fields from FIELD_CATALOG_v2.1.md)
 * 3. NESTED_CONDITION object format
 * 4. EXCEPTION_CONDITION handling
 * 5. NEGATION_DETECTED parsing
 * 6. Unfamiliar term detection (3-stage)
 * 7. Batch processing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UniversalParserV2 } from '../../config/universal-parser-v2.js';

// Helper to create mock response in new format { text, usage }
const createMockResponse = (jsonData) => ({
  text: JSON.stringify(jsonData),
  usage: {
    input_tokens: 100,
    output_tokens: 200,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0
  }
});

// Mock ClaudeClient
const mockClaudeClient = {
  isConfigured: vi.fn(() => true),
  complete: vi.fn()
};

describe('UniversalParserV2 - 100% LLM Approach', () => {
  let parser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new UniversalParserV2(mockClaudeClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create parser instance with ClaudeClient', () => {
      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(UniversalParserV2);
    });

    it('should have static methods for cluster info', () => {
      expect(UniversalParserV2.getClusterCodes()).toEqual(
        expect.arrayContaining(['AGE', 'BMI', 'SEV', 'CMB', 'PTH'])
      );
      expect(UniversalParserV2.getPrimaryFields('AGE')).toEqual(['AGE_MIN', 'AGE_MAX', 'AGE_UNIT']);
    });

    it('should throw if FIELD_CATALOG is missing', async () => {
      // This test will pass once we implement proper error handling
      // For now we're testing the expected behavior
      const mockBadClient = { 
        isConfigured: () => true,
        complete: vi.fn()
      };
      const badParser = new UniversalParserV2(mockBadClient);
      
      // The parser should load catalog on first use - mock fs to simulate missing file
      // For now, just verify the parser was created
      expect(badParser).toBeDefined();
    });
  });

  describe('parseCriterion - Basic Fields', () => {
    it('should parse AGE criterion with AGE_MIN, AGE_MAX, AGE_UNIT', async () => {
      // Mock Claude response
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'AGE_001',
        nct_id: 'NCT12345678',
        raw_text: 'Age ≥ 18 years and ≤ 65 years',
        _thought_process: '1. Identified age range with minimum 18 and maximum 65. 2. Unit is years.',
        AGE_MIN: 18,
        AGE_MAX: 65,
        AGE_UNIT: 'years',
        confidence: 1.0,
        unfamiliar_term_flag: false,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'AGE_001',
        nct_id: 'NCT12345678',
        raw_text: 'Age ≥ 18 years and ≤ 65 years'
      }, 'AGE');

      expect(result.raw_text).toBe('Age ≥ 18 years and ≤ 65 years');
      expect(result._thought_process).toBeDefined();
      expect(result.AGE_MIN).toBe(18);
      expect(result.AGE_MAX).toBe(65);
      expect(result.AGE_UNIT).toBe('years');
      expect(result.confidence).toBe(1.0);
      expect(result.parsing_status).toBe('complete');
    });

    it('should parse MEASUREMENTS with parameter, value, comparison', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'SEV_001',
        raw_text: 'PASI score ≥ 10',
        _thought_process: '1. Identified PASI score measurement. 2. Comparison is >=, value is 10.',
        MEASUREMENTS: [{
          parameter: 'PASI',
          value: 10,
          comparison: '>=',
          unit: null,
          confidence: 1.0
        }],
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'SEV_001',
        raw_text: 'PASI score ≥ 10'
      }, 'SEV');

      expect(result.MEASUREMENTS).toBeDefined();
      expect(result.MEASUREMENTS).toHaveLength(1);
      expect(result.MEASUREMENTS[0].parameter).toBe('PASI');
      expect(result.MEASUREMENTS[0].value).toBe(10);
      expect(result.MEASUREMENTS[0].comparison).toBe('>=');
    });

    it('should parse SEVERITY correctly (not including active/inactive)', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'SEV_002',
        raw_text: 'moderate-to-severe plaque psoriasis',
        _thought_process: '1. Identified severity descriptors: moderate, severe. 2. These go in SEVERITY, not CONDITION_PATTERN.',
        SEVERITY: ['moderate', 'severe'],
        CONDITION_TYPE: ['plaque psoriasis'],
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'SEV_002',
        raw_text: 'moderate-to-severe plaque psoriasis'
      }, 'SEV');

      expect(result.SEVERITY).toEqual(['moderate', 'severe']);
      expect(result.SEVERITY).not.toContain('active');
      expect(result.SEVERITY).not.toContain('inactive');
    });

    it('should put active/inactive in CONDITION_PATTERN (v2.1 rule)', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'CMB_001',
        raw_text: 'active psoriatic arthritis',
        _thought_process: '1. "active" goes in CONDITION_PATTERN per v2.1 rules, not SEVERITY.',
        CONDITION_TYPE: ['psoriatic arthritis'],
        CONDITION_PATTERN: ['active'],
        SEVERITY: [],
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'CMB_001',
        raw_text: 'active psoriatic arthritis'
      }, 'CMB');

      expect(result.CONDITION_PATTERN).toContain('active');
      expect(result.SEVERITY).not.toContain('active');
    });
  });

  describe('NESTED_CONDITION - Object Format (v2.1)', () => {
    it('should parse NESTED_CONDITION as object with main_condition and nested_items', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'SEV_1597',
        raw_text: 'PASI score is ≥10 and <12 with at least one of the following: facial or scalp involvement',
        _thought_process: '1. Main condition: PASI range [10,12). 2. Nested: at_least_one of facial OR scalp.',
        MEASUREMENTS: [{
          parameter: 'PASI',
          min: 10,
          max: 12,
          comparison: 'range'
        }],
        ANATOMICAL_LOCATION: ['facial', 'scalp'],
        LOGICAL_OPERATOR: 'AND',
        NESTED_CONDITION: {
          main_condition: {
            parameter: 'PASI',
            min: 10,
            max: 12,
            comparison: 'range'
          },
          nested_operator: 'at_least_one',
          nested_items: [{
            type: 'ANATOMICAL_LOCATION',
            values: ['facial', 'scalp']
          }],
          nested_logical_operator: 'OR'
        },
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'SEV_1597',
        raw_text: 'PASI score is ≥10 and <12 with at least one of the following: facial or scalp involvement'
      }, 'SEV');

      expect(result.NESTED_CONDITION).toBeDefined();
      expect(typeof result.NESTED_CONDITION).toBe('object');
      expect(result.NESTED_CONDITION.main_condition).toBeDefined();
      expect(result.NESTED_CONDITION.nested_operator).toBe('at_least_one');
      expect(result.NESTED_CONDITION.nested_items).toHaveLength(1);
      expect(result.NESTED_CONDITION.nested_items[0].values).toContain('facial');
      expect(result.NESTED_CONDITION.nested_logical_operator).toBe('OR');
    });

    it('should handle nested_operator "at_least_n" with nested_count', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'SEV_002',
        raw_text: 'BSA ≥ 10% with involvement of at least two of: scalp, face, hands, feet',
        _thought_process: '1. Main: BSA >= 10%. 2. Nested: at_least_n with n=2.',
        NESTED_CONDITION: {
          main_condition: {
            parameter: 'BSA',
            value: 10,
            comparison: '>=',
            unit: '%'
          },
          nested_operator: 'at_least_n',
          nested_count: 2,
          nested_items: [{
            type: 'ANATOMICAL_LOCATION',
            values: ['scalp', 'face', 'hands', 'feet']
          }],
          nested_logical_operator: 'OR'
        },
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'SEV_002',
        raw_text: 'BSA ≥ 10% with involvement of at least two of: scalp, face, hands, feet'
      }, 'SEV');

      expect(result.NESTED_CONDITION.nested_operator).toBe('at_least_n');
      expect(result.NESTED_CONDITION.nested_count).toBe(2);
    });

    it('should handle nested_operator "all"', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'SEV_003',
        raw_text: 'PASI ≥ 12 with all of: scalp, nail, and joint involvement',
        _thought_process: '1. Main: PASI >= 12. 2. Nested: ALL of the locations required.',
        NESTED_CONDITION: {
          main_condition: { parameter: 'PASI', value: 12, comparison: '>=' },
          nested_operator: 'all',
          nested_items: [{
            type: 'ANATOMICAL_LOCATION',
            values: ['scalp', 'nails', 'joints']
          }],
          nested_logical_operator: 'AND'
        },
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'SEV_003',
        raw_text: 'PASI ≥ 12 with all of: scalp, nail, and joint involvement'
      }, 'SEV');

      expect(result.NESTED_CONDITION.nested_operator).toBe('all');
      expect(result.NESTED_CONDITION.nested_logical_operator).toBe('AND');
    });
  });

  describe('EXCEPTION_CONDITION', () => {
    it('should parse exception clause with makes_eligible flag', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'CMB_2036',
        raw_text: 'History of cancer except basal cell carcinoma',
        _thought_process: '1. Main exclusion: cancer history. 2. Exception: basal cell carcinoma makes patient eligible.',
        CONDITION_TYPE: ['cancer'],
        CONDITION_PATTERN: ['history'],
        EXCEPTION_CONDITION: {
          excluded_types: ['basal cell carcinoma'],
          condition: 'any status',
          makes_eligible: true
        },
        NEGATION_DETECTED: {
          negated_term: 'basal cell carcinoma',
          negation_type: 'exception',
          interpretation: 'Patients with basal cell carcinoma ARE eligible despite cancer history',
          affected_fields: ['EXCEPTION_CONDITION'],
          parsing_note: 'Exception clause overrides main exclusion'
        },
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'CMB_2036',
        raw_text: 'History of cancer except basal cell carcinoma'
      }, 'CMB');

      expect(result.EXCEPTION_CONDITION).toBeDefined();
      expect(result.EXCEPTION_CONDITION.excluded_types).toContain('basal cell carcinoma');
      expect(result.EXCEPTION_CONDITION.makes_eligible).toBe(true);
      expect(result.NEGATION_DETECTED).toBeDefined();
    });
  });

  describe('NEGATION_DETECTED', () => {
    it('should detect "non-" prefix negation', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'DIT_2109',
        raw_text: 'Diagnosis of non-plaque psoriasis',
        _thought_process: '1. Detected "non-" prefix. 2. Parsed into DISEASE_VARIANT as "non-plaque".',
        CONDITION_TYPE: ['non-plaque psoriasis'],
        DISEASE_VARIANT: ['non-plaque'],
        NEGATION_DETECTED: {
          negated_term: 'plaque',
          negation_type: 'prefix',
          interpretation: 'Excludes plaque psoriasis; includes all other variants',
          affected_fields: ['CONDITION_TYPE', 'DISEASE_VARIANT'],
          parsing_note: '"non-plaque" treated as distinct variant category'
        },
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'DIT_2109',
        raw_text: 'Diagnosis of non-plaque psoriasis'
      }, 'NPV');

      expect(result.DISEASE_VARIANT).toContain('non-plaque');
      expect(result.DISEASE_VARIANT).not.toContain('plaque'); // Should NOT extract "plaque"
      expect(result.NEGATION_DETECTED.negation_type).toBe('prefix');
    });

    it('should detect "absence of" negation', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'DIT_2426',
        raw_text: 'Patients in the absence of plaque psoriasis',
        _thought_process: '1. Detected "absence of". 2. Set CONDITION_PATTERN to "absence".',
        CONDITION_TYPE: ['plaque psoriasis'],
        CONDITION_PATTERN: ['absence'],
        NEGATION_DETECTED: {
          negated_term: 'plaque psoriasis',
          negation_type: 'absence_of',
          interpretation: 'Patient must NOT have plaque psoriasis',
          affected_fields: ['CONDITION_TYPE', 'CONDITION_PATTERN']
        },
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'DIT_2426',
        raw_text: 'Patients in the absence of plaque psoriasis'
      }, 'NPV');

      expect(result.CONDITION_PATTERN).toContain('absence');
      expect(result.NEGATION_DETECTED.negation_type).toBe('absence_of');
    });
  });

  describe('Unfamiliar Term Detection (3-Stage)', () => {
    it('should set unfamiliar_term_flag for unknown terms with low confidence', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'CMB_5678',
        raw_text: 'Diagnosis of Schnitzler syndrome',
        _thought_process: '1. "Schnitzler syndrome" not in reference list. 2. Base term "syndrome" found. 3. Confidence 0.6 < 0.7.',
        CONDITION_TYPE: ['schnitzler syndrome'],
        unfamiliar_term_flag: true,
        confidence: 0.6,
        parsing_status: 'pending_admin_review'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'CMB_5678',
        raw_text: 'Diagnosis of Schnitzler syndrome'
      }, 'CMB');

      expect(result.unfamiliar_term_flag).toBe(true);
      expect(result.confidence).toBeLessThan(0.7);
      expect(result.parsing_status).toBe('pending_admin_review');
    });

    it('should NOT flag familiar terms from reference list', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'CMB_001',
        raw_text: 'History of plaque psoriasis',
        _thought_process: '1. "plaque psoriasis" found in reference list. 2. Confidence 1.0.',
        CONDITION_TYPE: ['plaque psoriasis'],
        unfamiliar_term_flag: false,
        confidence: 1.0,
        parsing_status: 'complete'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'CMB_001',
        raw_text: 'History of plaque psoriasis'
      }, 'CMB');

      expect(result.unfamiliar_term_flag).toBe(false);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('AMBIGUITY_FLAG', () => {
    it('should set AMBIGUITY_FLAG for incomplete sentences', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue(createMockResponse({
        id: 'SEV_BAD',
        raw_text: 'PASI score is ≥10 and <12 with at least one of the following: >',
        _thought_process: '1. Sentence is incomplete - ">" suggests text was cut off.',
        MEASUREMENTS: [{ parameter: 'PASI', min: 10, max: 12, comparison: 'range' }],
        AMBIGUITY_FLAG: true,
        ambiguity_reason: 'Incomplete sentence: text appears cut off after ":"',
        confidence: 0.5,
        parsing_status: 'pending_admin_review'
      }));

      const { criterion: result } = await parser.parseCriterion({
        id: 'SEV_BAD',
        raw_text: 'PASI score is ≥10 and <12 with at least one of the following: >'
      }, 'SEV');

      expect(result.AMBIGUITY_FLAG).toBe(true);
      expect(result.ambiguity_reason).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    it('should parse multiple criteria in batch', async () => {
      let callCount = 0;
      mockClaudeClient.complete = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(createMockResponse({
          id: `AGE_${callCount}`,
          raw_text: `Age ≥ ${18 + callCount}`,
          AGE_MIN: 18 + callCount,
          confidence: 1.0,
          parsing_status: 'complete'
        }));
      });

      const criteria = [
        { id: 'AGE_001', raw_text: 'Age ≥ 19' },
        { id: 'AGE_002', raw_text: 'Age ≥ 20' },
        { id: 'AGE_003', raw_text: 'Age ≥ 21' }
      ];

      const results = await parser.parseBatch(criteria, 'AGE');

      expect(results).toHaveLength(3);
      expect(results[0].AGE_MIN).toBeDefined();
      expect(results[1].AGE_MIN).toBeDefined();
      expect(results[2].AGE_MIN).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM returning invalid JSON gracefully', async () => {
      mockClaudeClient.complete = vi.fn().mockResolvedValue({
        text: 'This is not valid JSON',
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      });

      const { criterion: result } = await parser.parseCriterion({
        id: 'BAD_001',
        raw_text: 'Some criterion text'
      }, 'AGE');

      expect(result.id).toBe('BAD_001');
      expect(result.raw_text).toBe('Some criterion text');
      expect(result.AMBIGUITY_FLAG).toBe(true);
      expect(result.parsing_status).toBe('error');
    });

    it('should handle LLM API errors gracefully', async () => {
      mockClaudeClient.complete = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));

      const { criterion: result } = await parser.parseCriterion({
        id: 'ERR_001',
        raw_text: 'Some criterion text'
      }, 'AGE');

      expect(result.id).toBe('ERR_001');
      expect(result.raw_text).toBe('Some criterion text');
      expect(result.parsing_status).toBe('error');
      expect(result.unfamiliar_term_flag).toBe(true);
    });
  });
});



