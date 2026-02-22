/**
 * @file dropdownRendering.test.jsx
 * @description Tests that follow-up questions render as dropdowns/radio buttons based on question.type
 * 
 * TDD: This test is written FIRST before the fix is implemented.
 * The test should FAIL initially because frontend only handles 'select' but not 'radio' type.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClinicalTrialEligibilityQuestionnaire from '../../ClinicalTrialEligibilityQuestionnaire';

describe('Follow-up Question Dropdown Rendering', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Mock fetch to return questions with type: 'radio' and type: 'select'
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/followups/generate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            questions: [
              {
                id: 'q1',
                text: 'What type of diabetes have you been diagnosed with?',
                type: 'radio',
                options: ['Type 1 diabetes', 'Type 2 diabetes', 'Gestational diabetes'],
                required: true,
                criterionIds: ['CMB_2031']
              },
              {
                id: 'q2',
                text: 'How long ago were you diagnosed?',
                type: 'select',
                options: ['Less than 6 months', '6 months to 1 year', '1-5 years', 'More than 5 years'],
                required: true,
                criterionIds: ['CMB_2030']
              },
              {
                id: 'q3',
                text: 'Any additional notes?',
                type: 'text',
                required: false,
                criterionIds: ['CMB_2029']
              }
            ],
            conditionType: 'metabolic',
            conditionName: 'diabetes',
            aiGenerated: true,
            cached: false,
            source: 'ai'
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Condition Follow-Up Questions', () => {
    it('should render dropdown for questions with type: "radio" (converted for space efficiency)', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire />);

      // Already on step 1 (CMB cluster) - answer yes to having conditions
      const yesRadio = screen.getByRole('radio', { name: /yes/i });
      await user.click(yesRadio);

      // Wait for condition input to appear - it uses the hint as placeholder
      const conditionInput = await screen.findByPlaceholderText(/depression.*diabetes|heart failure/i);
      await user.type(conditionInput, 'diabetes');

      // Click add button
      const addButton = screen.getByRole('button', { name: /add condition/i });
      await user.click(addButton);

      // Wait for dynamic questions to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/followups/generate'),
          expect.any(Object)
        );
      });

      // Wait for the question text to appear (may find multiple due to developer view)
      await waitFor(() => {
        const elements = screen.getAllByText(/What type of diabetes/i);
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // type: 'radio' should now render as dropdown (select) for space efficiency
      // We should have at least 2 dropdowns: one for radio question, one for select question
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
      
      // Verify the radio-type question options are available in a dropdown
      expect(screen.getByRole('option', { name: /Type 1 diabetes/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Type 2 diabetes/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Gestational diabetes/i })).toBeInTheDocument();
    });

    it('should render select dropdown for questions with type: "select"', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire />);

      // Answer yes to having conditions
      const yesRadio = screen.getByRole('radio', { name: /yes/i });
      await user.click(yesRadio);

      // Add condition
      const conditionInput = await screen.findByPlaceholderText(/depression.*diabetes|heart failure/i);
      await user.type(conditionInput, 'diabetes');
      
      const addButton = screen.getByRole('button', { name: /add condition/i });
      await user.click(addButton);

      // Wait for dynamic questions
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Wait for the question text to appear
      await waitFor(() => {
        const elements = screen.getAllByText(/How long ago were you diagnosed/i);
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Check that select dropdown is rendered for type: 'select' questions
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);

      // Verify select options are present
      expect(screen.getByRole('option', { name: /Less than 6 months/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /6 months to 1 year/i })).toBeInTheDocument();
    });

    it('should render text input for questions with type: "text"', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire />);

      // Answer yes and add condition
      const yesRadio = screen.getByRole('radio', { name: /yes/i });
      await user.click(yesRadio);

      const conditionInput = await screen.findByPlaceholderText(/depression.*diabetes|heart failure/i);
      await user.type(conditionInput, 'diabetes');
      
      const addButton = screen.getByRole('button', { name: /add condition/i });
      await user.click(addButton);

      // Wait for dynamic questions
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Wait for the question text to appear
      await waitFor(() => {
        const elements = screen.getAllByText(/Any additional notes/i);
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // For type: 'text' questions, should render text input with placeholder
      const textInputs = screen.getAllByPlaceholderText(/your answer|enter/i);
      expect(textInputs.length).toBeGreaterThanOrEqual(1);
    });

    it('should NOT render radio buttons for questions with type: "radio" (uses dropdown instead)', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire />);

      // Answer yes and add condition
      const yesRadio = screen.getByRole('radio', { name: /yes/i });
      await user.click(yesRadio);

      const conditionInput = await screen.findByPlaceholderText(/depression.*diabetes|heart failure/i);
      await user.type(conditionInput, 'diabetes');
      
      const addButton = screen.getByRole('button', { name: /add condition/i });
      await user.click(addButton);

      // Wait for questions to be displayed
      await waitFor(() => {
        const elements = screen.getAllByText(/What type of diabetes/i);
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Radio button count should be ONLY 2 (for yes/no) - no additional radios for follow-up questions
      // Because type: 'radio' questions now render as dropdowns
      const allRadios = screen.getAllByRole('radio');
      expect(allRadios.length).toBe(2); // Only yes/no, not the diabetes type options
      
      // The diabetes type options should be in a dropdown, not as radio buttons
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2); // At least 2 dropdowns
      
      // Verify options are in dropdown, not as labels with radio buttons
      const type1Option = screen.getByRole('option', { name: /Type 1 diabetes/i });
      expect(type1Option.tagName).toBe('OPTION');
    });
  });
});
