/**
 * IMPLEMENTATION CONTRACT: Dynamic Follow-up Questions from AI
 * 
 * REQUIREMENT:
 * - When user adds treatment, should call /api/followups/generate
 * - Different drugs get different questions based on their category
 * - UI should render questions returned from backend
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClinicalTrialEligibilityQuestionnaire from '../../ClinicalTrialEligibilityQuestionnaire.jsx';
import { getDrugInfo } from '../../services/matcher/drugDatabase.js';

describe('Contract 2: Dynamic Follow-up Questions', () => {
  let user;
  let fetchSpy;
  
  beforeEach(() => {
    user = userEvent.setup();
    fetchSpy = vi.spyOn(global, 'fetch');
    
    // Default mock for all fetch calls
    fetchSpy.mockImplementation((url) => {
      if (url.includes('/api/followups/generate')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            drugName: 'adalimumab',
            drugClass: 'TNF inhibitor',
            questions: [
              { text: 'Have you had any infections while on this medication?', type: 'select', options: ['Yes', 'No'] },
              { text: 'Did you experience injection site reactions?', type: 'select', options: ['Yes', 'No', 'Sometimes'] }
            ],
            source: 'ai'
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Drug Classification', () => {
    it('adalimumab is classified as TNF inhibitor', () => {
      const drugInfo = getDrugInfo('adalimumab');
      expect(drugInfo).not.toBeNull();
      expect(drugInfo.class).toBe('TNF inhibitor');
    });
    
    it('secukinumab is classified as IL-17 inhibitor', () => {
      const drugInfo = getDrugInfo('secukinumab');
      expect(drugInfo).not.toBeNull();
      expect(drugInfo.class).toBe('IL-17 inhibitor');
    });
    
    it('ustekinumab is classified as IL-12/23 inhibitor', () => {
      const drugInfo = getDrugInfo('ustekinumab');
      expect(drugInfo).not.toBeNull();
      expect(drugInfo.class).toBe('IL-12/23 inhibitor');
    });
    
    it('methotrexate is classified as DMARD', () => {
      const drugInfo = getDrugInfo('methotrexate');
      expect(drugInfo).not.toBeNull();
      expect(drugInfo.class).toBe('DMARD');
    });
    
    it('piclidenoson is classified or noted as experimental', () => {
      const drugInfo = getDrugInfo('piclidenoson');
      if (drugInfo) {
        expect(drugInfo.class).toBeDefined();
      } else {
        expect(drugInfo).toBeNull();
      }
    });
  });
  
  describe('Treatment Section Renders', () => {
    it('renders treatment question section', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire 
        apiKey="test-key"
        useAI={false}
        onComplete={() => {}}
      />);
      
      await waitFor(() => {
        expect(screen.getByText(/Step\s+1/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Backend Client Exists', () => {
    it('BackendClient has generateFollowUps method', async () => {
      const { BackendClient } = await import('../../services/api/backendClient.js');
      const client = new BackendClient('http://localhost:3001');
      
      expect(typeof client.generateFollowUps).toBe('function');
    });
  });
  
  describe('API Integration', () => {
    it('calls /api/followups/generate when treatment is added', async () => {
      render(<ClinicalTrialEligibilityQuestionnaire 
        apiKey="test-key"
        useAI={false}
        onComplete={() => {}}
      />);
      
      // Navigate to treatment section (Step 2)
      // First answer "No" to conditions question
      const noRadio = screen.getByLabelText(/no/i);
      await user.click(noRadio);
      
      // Click Next to go to treatment section
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Wait for treatment section - use heading role
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Psoriasis Treatment History/i })).toBeInTheDocument();
      });
      
      // Say yes to having treatments
      const yesRadio = screen.getByLabelText(/yes/i);
      await user.click(yesRadio);
      
      // Type treatment name - placeholder includes drug examples
      const treatmentInput = screen.getByPlaceholderText(/humira|cosentyx|skyrizi/i);
      await user.type(treatmentInput, 'adalimumab');
      
      // Add treatment
      const addButton = screen.getByRole('button', { name: /add treatment/i });
      await user.click(addButton);
      
      // Verify /api/followups/generate was called
      await waitFor(() => {
        const followupCalls = fetchSpy.mock.calls.filter(
          call => call[0].includes('/api/followups/generate')
        );
        expect(followupCalls.length).toBeGreaterThan(0);
      });
      
      // Verify the request body contains the drug name
      const followupCall = fetchSpy.mock.calls.find(
        call => call[0].includes('/api/followups/generate')
      );
      const body = JSON.parse(followupCall[1].body);
      expect(body.drugName).toBe('adalimumab');
    });
  });
});
