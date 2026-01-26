/**
 * @file Structured Questions Tests
 * Tests for: select type enforcement, slotMapping, criteria-derived options
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDatabase, initDatabase } from '../../db.js';
import { 
  generateFollowUpQuestions,
  clearCache,
  deriveTimingOptions
} from '../../services/FollowUpGenerator.js';

// Mock the ClaudeClient to avoid real API calls in tests
vi.mock('../../services/ClaudeClient.js', () => ({
  getClaudeClient: () => ({
    isConfigured: () => false,  // Return false to skip AI calls and use defaults
    initFromDatabase: async () => {}
  })
}));

describe('Structured Questions with Slot Mapping', () => {
  beforeEach(async () => {
    await initDatabase();
    await clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  describe('Question type enforcement', () => {
    it('should return select type for timing questions, not text', async () => {
      const result = await generateFollowUpQuestions('adalimumab');
      
      // Find timing-related questions
      const timingQuestions = result.questions.filter(q => 
        q.text.toLowerCase().includes('currently') ||
        q.text.toLowerCase().includes('when') ||
        q.text.toLowerCase().includes('last') ||
        q.id === 'timing' ||
        q.id === 'usage_status'
      );
      
      // All timing questions should be select type
      for (const q of timingQuestions) {
        expect(q.type).toBe('select');
        expect(q.options).toBeInstanceOf(Array);
        expect(q.options.length).toBeGreaterThan(0);
      }
    });

    it('should not have text type for any required question', async () => {
      const result = await generateFollowUpQuestions('secukinumab');
      
      const textQuestions = result.questions.filter(q => 
        q.type === 'text' && q.required === true
      );
      
      // No required questions should be free text
      expect(textQuestions.length).toBe(0);
    });
  });

  describe('slotMapping field', () => {
    it('should include slotMapping for timing questions', async () => {
      const result = await generateFollowUpQuestions('adalimumab');
      
      const timingQuestion = result.questions.find(q => 
        q.id === 'timing' || q.id === 'usage_status' ||
        q.text.toLowerCase().includes('currently')
      );
      
      expect(timingQuestion).toBeDefined();
      expect(timingQuestion.slotMapping).toBeDefined();
      expect(typeof timingQuestion.slotMapping).toBe('object');
    });

    it('should have valid slot-filled values in slotMapping', async () => {
      const result = await generateFollowUpQuestions('adalimumab');
      
      const timingQuestion = result.questions.find(q => q.slotMapping);
      
      if (timingQuestion) {
        // Each option should map to a valid slot-filled structure
        for (const [option, slotValue] of Object.entries(timingQuestion.slotMapping)) {
          // Should have usage_current or TIMEFRAME
          expect(
            slotValue.usage_current !== undefined || 
            slotValue.TIMEFRAME !== undefined
          ).toBe(true);
          
          // If TIMEFRAME, should have proper structure
          if (slotValue.TIMEFRAME) {
            expect(typeof slotValue.TIMEFRAME.amount).toBe('number');
            expect(['weeks', 'months', 'days', 'years']).toContain(slotValue.TIMEFRAME.unit);
          }
        }
      }
    });

    it('should have matching options in slotMapping keys', async () => {
      const result = await generateFollowUpQuestions('adalimumab');
      
      const timingQuestion = result.questions.find(q => q.slotMapping && q.options);
      
      if (timingQuestion) {
        // All options should have corresponding slotMapping entries
        for (const option of timingQuestion.options) {
          expect(timingQuestion.slotMapping[option]).toBeDefined();
        }
      }
    });
  });

  describe('deriveTimingOptions function', () => {
    it('should derive options from criteria timeframes', () => {
      const criteria = [
        { id: 'PTH_001', TIMEFRAME: { amount: 12, unit: 'weeks' } },
        { id: 'PTH_002', TIMEFRAME: { amount: 6, unit: 'months' } },
        { id: 'PTH_003', raw_text: 'currently receiving treatment' }
      ];
      
      const options = deriveTimingOptions(criteria);
      
      // Should include "Currently taking"
      expect(options.some(o => o.label.toLowerCase().includes('currently'))).toBe(true);
      
      // Should have options based on 12 weeks and 6 months thresholds
      expect(options.length).toBeGreaterThanOrEqual(3);
      
      // Each option should have slotValue
      for (const option of options) {
        expect(option.label).toBeTruthy();
        expect(option.slotValue).toBeDefined();
      }
    });

    it('should normalize timeframes to weeks for comparison', () => {
      const criteria = [
        { id: 'PTH_001', TIMEFRAME: { amount: 3, unit: 'months' } }, // = 12 weeks
        { id: 'PTH_002', TIMEFRAME: { amount: 12, unit: 'weeks' } }
      ];
      
      const options = deriveTimingOptions(criteria);
      
      // Should NOT have duplicate options for same timeframe
      const labels = options.map(o => o.label);
      const uniqueLabels = [...new Set(labels)];
      expect(labels.length).toBe(uniqueLabels.length);
    });

    it('should always include "beyond all thresholds" option', () => {
      const criteria = [
        { id: 'PTH_001', TIMEFRAME: { amount: 4, unit: 'weeks' } }
      ];
      
      const options = deriveTimingOptions(criteria);
      
      // Last option should indicate "beyond" the max threshold
      const beyondOption = options.find(o => 
        o.label.toLowerCase().includes('over') ||
        o.slotValue?.TIMEFRAME?.relation === 'beyond'
      );
      
      expect(beyondOption).toBeDefined();
    });
  });
});
