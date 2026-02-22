/**
 * Integration Test: Multiple Criterion IDs per Follow-Up Question
 * 
 * Tests that the report generation correctly displays multiple criterion IDs
 * when AI-generated questions address multiple related criteria.
 */

import { describe, it, expect } from 'vitest';
import { generatePatientNarrative } from '../../components/App';

describe('Multiple Criterion IDs per Follow-Up Question', () => {
  it('should display multiple criterion IDs in report when question has criterionIds array', () => {
    const responses = {
      AGE: { age: 35 },
      CMB: [
        {
          CONDITION_TYPE: 'gastritis',
          SEVERITY: 'moderate',
          dynamicQuestions: [
            {
              id: 'q1',
              text: 'How long have you had gastritis?',
              criterionIds: ['CMB_2391', 'CMB_2392'], // Multiple IDs
            },
          ],
          q1: '18 months',
        },
      ],
      PTH: [],
    };

    const report = generatePatientNarrative(responses);

    // Should show "Criteria: CMB_2391, CMB_2392" (plural, with BOTH IDs)
    expect(report).toContain('Criteria: CMB_2391, CMB_2392');
    
    // Should show the question and answer
    expect(report).toContain('How long have you had gastritis?');
    expect(report).toContain('18 months');
  });

  it('should handle backward compatibility with single criterionId (old format)', () => {
    const responses = {
      AGE: { age: 55 },
      CMB: [
        {
          CONDITION_TYPE: 'diabetes',
          dynamicQuestions: [
            {
              id: 'q1',
              text: 'When were you diagnosed with diabetes?',
              criterionId: 'CMB_1234', // Old format: single ID
            },
          ],
          q1: '2020',
        },
      ],
      PTH: [],
    };

    const report = generatePatientNarrative(responses);

    // Should still work with old format, converted to "Criteria: CMB_1234"
    expect(report).toContain('Criteria: CMB_1234');
    expect(report).toContain('When were you diagnosed with diabetes?');
    expect(report).toContain('2020');
  });

  it('should handle treatment follow-ups with multiple criterion IDs', () => {
    const responses = {
      AGE: { age: 42 },
      CMB: [],
      PTH: [
        {
          TREATMENT_TYPE: 'adalimumab',
          TREATMENT_PATTERN: 'stopped',
          dynamicQuestions: [
            {
              id: 'q1',
              text: 'How long ago did you stop taking this medication?',
              criterionIds: ['PTH_5432', 'PTH_5433', 'PTH_5434'], // 3 related criteria
            },
          ],
          q1: '12 weeks',
        },
      ],
    };

    const report = generatePatientNarrative(responses);

    // Should show all 3 criterion IDs
    expect(report).toContain('Criteria: PTH_5432, PTH_5433, PTH_5434');
    expect(report).toContain('How long ago did you stop taking this medication?');
    expect(report).toContain('12 weeks');
  });

  it('should handle questions with no criterion IDs gracefully', () => {
    const responses = {
      AGE: { age: 28 },
      CMB: [
        {
          CONDITION_TYPE: 'asthma',
          dynamicQuestions: [
            {
              id: 'q1',
              text: 'Do you currently have asthma?',
              // No criterionId or criterionIds
            },
          ],
          q1: 'yes',
        },
      ],
      PTH: [],
    };

    const report = generatePatientNarrative(responses);

    // Should still show question and answer, just without criterion label
    expect(report).toContain('Do you currently have asthma?');
    expect(report).toContain('yes');
    // Should NOT crash or show "Criteria: undefined"
    expect(report).not.toContain('Criteria: undefined');
    expect(report).not.toContain('Criteria: null');
  });
});
