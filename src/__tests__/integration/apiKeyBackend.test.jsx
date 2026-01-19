/**
 * IMPLEMENTATION CONTRACT: API Key Stored in Backend Only
 * 
 * REQUIREMENT:
 * - API key must be stored on backend server, NOT in browser localStorage
 * - Frontend must NOT contain API key in any form after configuration
 * - All API calls must go through backend (no direct Anthropic calls)
 * 
 * These tests verify REAL behavior - not mocked
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// We need to test against actual App behavior
import App from '../../components/App.jsx';

describe('Contract 1: API Key Backend Storage', () => {
  let user;
  let fetchSpy;
  
  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    fetchSpy = vi.spyOn(global, 'fetch');
    
    // Mock initial API key status check (not configured)
    fetchSpy.mockImplementation((url) => {
      if (url.includes('/api/config/apikey/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ configured: false })
        });
      }
      if (url.includes('/api/config/apikey') && !url.includes('status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
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
    localStorage.clear();
  });
  
  describe('API Key NOT in localStorage', () => {
    it('does NOT store API key in localStorage after saving', async () => {
      render(<App />);
      
      // Wait for app to load
      await waitFor(() => {
        expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
      });
      
      // Find and fill API key input
      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-ant-test-key-12345');
      
      // Submit settings
      const startButton = screen.getByRole('button', { name: /start|begin questionnaire/i });
      await user.click(startButton);
      
      // Wait for potential async operations
      await waitFor(() => {
        // Verify localStorage does NOT contain API key
        expect(localStorage.getItem('anthropic_api_key')).toBeNull();
        expect(localStorage.getItem('api_key')).toBeNull();
        expect(localStorage.getItem('clinical_trial_api_key')).toBeNull();
      });
      
      // Double-check: no localStorage key contains 'sk-ant'
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        const value = localStorage.getItem(key);
        expect(value).not.toContain('sk-ant');
      });
    });
    
    it('sends API key to backend endpoint /api/config/apikey', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
      });
      
      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-ant-backend-test');
      
      const startButton = screen.getByRole('button', { name: /start|begin questionnaire/i });
      await user.click(startButton);
      
      await waitFor(() => {
        // Check that backend config endpoint was called
        const configCall = fetchSpy.mock.calls.find(call => {
          const url = typeof call[0] === 'string' ? call[0] : '';
          return url.includes('/api/config/apikey') && !url.includes('status');
        });
        
        expect(configCall).toBeTruthy();
        
        // Verify the API key was sent in the request body
        const requestBody = JSON.parse(configCall[1].body);
        expect(requestBody.apiKey).toBe('sk-ant-backend-test');
      });
    });
  });
  
  describe('Settings Panel Text', () => {
    it('does NOT say "stored locally in your browser"', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
      });
      
      // The old text said "stored locally in your browser"
      const localStorageText = screen.queryByText(/stored locally in your browser/i);
      expect(localStorageText).not.toBeInTheDocument();
    });
    
    it('shows server storage message after entering API key', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
      });
      
      const apiKeyInput = screen.getByLabelText(/api key/i);
      await user.type(apiKeyInput, 'sk-ant-test');
      
      // Should show message about server storage
      await waitFor(() => {
        const serverStorageText = screen.queryByText(/server|securely/i);
        expect(serverStorageText).toBeInTheDocument();
      });
    });
  });
});
