/**
 * IMPLEMENTATION CONTRACT: Lung Cancer in Autocomplete + Synonym Matching
 * 
 * REQUIREMENT:
 * - "lung cancer" appears in condition autocomplete suggestions
 * - "lung cancer" matches criteria with "malignancy" or "cancer"
 * - Other cancer types also in suggestions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClinicalTrialEligibilityQuestionnaire from '../../ClinicalTrialEligibilityQuestionnaire.jsx';
import { ClinicalTrialMatcher } from '../../services/matcher/ClinicalTrialMatcher.js';
import { findSynonyms } from '../../services/matcher/drugDatabase.js';
import SLOT_FILLED_DATABASE from '../../data/improved_slot_filled_database.json';

describe('Contract 3: Lung Cancer Autocomplete and Matching', () => {
  let user;
  
  beforeEach(() => {
    user = userEvent.setup();
  });
  
  describe('Autocomplete Suggestions', () => {
    it('shows "lung cancer" when typing "lung"', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire 
        apiKey="test-key"
        useAI={false}
        onComplete={() => {}}
      />);
      
      // Say Yes to having conditions
      const yesRadio = screen.getByLabelText(/yes/i);
      await user.click(yesRadio);
      
      // Type "lung" in the condition input
      const conditionInput = screen.getByPlaceholderText(/condition|depression|diabetes/i);
      await user.type(conditionInput, 'lung');
      
      // Wait for autocomplete suggestions
      await waitFor(() => {
        // "lung cancer" should appear in suggestions
        const lungCancerOption = screen.queryByText(/lung cancer/i);
        expect(lungCancerOption).toBeInTheDocument();
      });
    });
    
    it('shows "breast cancer" when typing "breast"', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire 
        apiKey="test-key"
        useAI={false}
        onComplete={() => {}}
      />);
      
      const yesRadio = screen.getByLabelText(/yes/i);
      await user.click(yesRadio);
      
      const conditionInput = screen.getByPlaceholderText(/condition|depression|diabetes/i);
      await user.type(conditionInput, 'breast');
      
      await waitFor(() => {
        const breastCancerOption = screen.queryByText(/breast cancer/i);
        expect(breastCancerOption).toBeInTheDocument();
      });
    });
    
    it('shows "cancer" as a general option', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire 
        apiKey="test-key"
        useAI={false}
        onComplete={() => {}}
      />);
      
      const yesRadio = screen.getByLabelText(/yes/i);
      await user.click(yesRadio);
      
      const conditionInput = screen.getByPlaceholderText(/condition|depression|diabetes/i);
      await user.type(conditionInput, 'canc');
      
      await waitFor(() => {
        // Multiple cancer options should appear - use getAllByText
        const cancerOptions = screen.getAllByText(/cancer/i);
        expect(cancerOptions.length).toBeGreaterThan(0);
        // Check that plain "cancer" is in the list
        const plainCancer = screen.getByText('cancer');
        expect(plainCancer).toBeInTheDocument();
      });
    });
  });
  
  describe('Synonym Matching', () => {
    it('lung cancer has synonyms including malignancy and cancer', () => {
      const synonyms = findSynonyms('lung cancer');
      
      expect(synonyms).toContain('cancer');
      expect(synonyms).toContain('malignancy');
    });
    
    it('breast cancer has synonyms including malignancy', () => {
      const synonyms = findSynonyms('breast cancer');
      
      expect(synonyms).toContain('cancer');
      expect(synonyms).toContain('malignancy');
    });
    
    it('melanoma has synonyms including malignancy and cancer', () => {
      const synonyms = findSynonyms('melanoma');
      
      expect(synonyms).toContain('cancer');
      expect(synonyms).toContain('malignancy');
    });
    
    it('lymphoma has synonyms including malignancy', () => {
      const synonyms = findSynonyms('lymphoma');
      
      expect(synonyms).toContain('cancer');
      expect(synonyms).toContain('malignancy');
    });
  });
  
  describe('Matcher Integration', () => {
    let matcher;
    
    beforeEach(() => {
      matcher = new ClinicalTrialMatcher(SLOT_FILLED_DATABASE);
    });
    
    it('evaluates patient with lung cancer condition', async () => {
      const patient = {
        responses: {
          CMB: [{
            CONDITION_TYPE: ['lung cancer'],
            CONDITION_PATTERN: ['history']
          }],
          AGE: { age: 45 }
        }
      };
      
      // The matcher should be able to evaluate trials
      const result = await matcher.evaluateTrial('NCT06648772', patient);
      
      // Result should have a status
      expect(result).toHaveProperty('status');
      expect(['eligible', 'ineligible', 'needs_review', 'inconclusive']).toContain(result.status);
    });
  });
});
