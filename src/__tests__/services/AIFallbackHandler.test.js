import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIFallbackHandler } from '../../services/matcher/AIFallbackHandler.js';

// Mock Claude client
const createMockClaudeClient = (mockResponse) => ({
  semanticMatch: vi.fn().mockResolvedValue(mockResponse),
});

describe('AIFallbackHandler', () => {
  describe('constructor', () => {
    it('should create handler with enabled=true when claudeClient is provided', () => {
      const mockClient = createMockClaudeClient({});
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      expect(handler.isEnabled()).toBe(true);
    });

    it('should create handler with enabled=false when claudeClient is null', () => {
      const handler = new AIFallbackHandler({ claudeClient: null, enabled: true });
      expect(handler.isEnabled()).toBe(false);
    });

    it('should create handler with enabled=false when explicitly disabled', () => {
      const mockClient = createMockClaudeClient({});
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: false });
      expect(handler.isEnabled()).toBe(false);
    });
  });

  describe('getClusterPrompts', () => {
    it('should return PTH-specific prompts for PTH cluster', () => {
      const handler = new AIFallbackHandler({ claudeClient: null });
      const prompts = handler.getClusterPrompts('PTH');
      expect(prompts.systemPrompt).toContain('clinical pharmacology');
      expect(typeof prompts.userPromptTemplate).toBe('function');
    });

    it('should return CMB-specific prompts for CMB cluster', () => {
      const handler = new AIFallbackHandler({ claudeClient: null });
      const prompts = handler.getClusterPrompts('CMB');
      expect(prompts.systemPrompt).toContain('medical expert');
    });

    it('should return DEFAULT prompts for unknown clusters', () => {
      const handler = new AIFallbackHandler({ claudeClient: null });
      const prompts = handler.getClusterPrompts('UNKNOWN_CLUSTER');
      expect(prompts.systemPrompt).toContain('clinical trial eligibility');
    });
  });

  describe('matchTreatmentHistory', () => {
    it('should return unavailable result when handler is disabled', async () => {
      const handler = new AIFallbackHandler({ claudeClient: null, enabled: false });
      
      const result = await handler.matchTreatmentHistory(
        'testdrug',
        ['criterion-drug'],
        'raw text',
        { id: 'PTH_001', nct_id: 'NCT001' }
      );

      expect(result.matches).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.matchMethod).toBe('ai_unavailable');
      expect(result.needsAdminReview).toBe(true);
    });

    it('should call Claude client and return match result', async () => {
      const mockClient = createMockClaudeClient({
        matches: true,
        confidence: 0.88,
        reasoning: 'Drug is semantically similar',
        suggestedClass: 'TNF inhibitor'
      });
      
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      
      const result = await handler.matchTreatmentHistory(
        'adalimumab',
        ['TNF inhibitor', 'biologic'],
        'No prior TNF inhibitor use',
        { id: 'PTH_001', nct_id: 'NCT001' }
      );

      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(0.88);
      expect(result.requiresAI).toBe(true);
      expect(result.matchMethod).toBe('ai_fallback');
      expect(result.needsAdminReview).toBe(true);
      expect(result.reviewPayload).toBeDefined();
      expect(result.reviewPayload.drugName).toBe('adalimumab');
      expect(result.reviewPayload.aiSuggestion.class).toBe('TNF inhibitor');
    });

    it('should cap AI confidence at 0.9', async () => {
      const mockClient = createMockClaudeClient({
        matches: true,
        confidence: 0.99, // Higher than cap
        reasoning: 'Very confident match'
      });
      
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      
      const result = await handler.matchTreatmentHistory(
        'drug',
        ['drug'],
        'text',
        { id: 'PTH_001', nct_id: 'NCT001' }
      );

      expect(result.confidence).toBe(0.9); // Capped
    });

    it('should handle Claude client errors gracefully', async () => {
      const mockClient = {
        semanticMatch: vi.fn().mockRejectedValue(new Error('API Error'))
      };
      
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      
      const result = await handler.matchTreatmentHistory(
        'drug',
        ['drug'],
        'text',
        { id: 'PTH_001', nct_id: 'NCT001' }
      );

      expect(result.matches).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.matchMethod).toBe('ai_error');
      expect(result.aiReasoning).toContain('AI error');
    });
  });

  describe('matchComorbidity', () => {
    it('should return match result for comorbidities', async () => {
      const mockClient = createMockClaudeClient({
        matches: true,
        confidence: 0.85,
        reasoning: 'Depression matches MDD'
      });
      
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      
      const result = await handler.matchComorbidity(
        { CONDITION_TYPE: ['depression'] },
        { CONDITION_TYPE: ['major depressive disorder', 'mdd'] },
        'No active depression',
        { id: 'CMB_001', nct_id: 'NCT001' }
      );

      expect(result.matches).toBe(true);
      expect(result.confidence).toBe(0.85);
      expect(result.requiresAI).toBe(true);
    });
  });

  describe('matchSeverity', () => {
    it('should return match result for severity assessment', async () => {
      const mockClient = createMockClaudeClient({
        matches: true,
        confidence: 0.82,
        reasoning: 'Severe psoriasis meets criterion'
      });
      
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      
      const result = await handler.matchSeverity(
        { PASI: 15, BSA: 12 },
        { SEVERITY_MIN: 'moderate' },
        'Moderate to severe psoriasis',
        { id: 'SEV_001', nct_id: 'NCT001' }
      );

      expect(result.matches).toBe(true);
      expect(result.requiresAI).toBe(true);
    });
  });

  describe('matchGeneric', () => {
    it('should handle any cluster type', async () => {
      const mockClient = createMockClaudeClient({
        matches: false,
        confidence: 0.78,
        reasoning: 'No match found'
      });
      
      const handler = new AIFallbackHandler({ claudeClient: mockClient, enabled: true });
      
      const result = await handler.matchGeneric(
        'BIO',
        { marker: 'CRP', value: 5 },
        { marker: 'CRP', threshold: 10 },
        'CRP below 10',
        { id: 'BIO_001', nct_id: 'NCT001' }
      );

      expect(result.matches).toBe(false);
      expect(result.requiresAI).toBe(true);
    });
  });
});
