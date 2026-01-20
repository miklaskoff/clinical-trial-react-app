/**
 * @file Integration tests for Admin API Key Configuration UI
 * 
 * IMPLEMENTATION CONTRACT:
 * - Admin must see "Settings" tab in admin dashboard
 * - Admin must be able to enter API key
 * - Save button must call /api/config/apikey endpoint
 * - Status must show configured/not-configured
 * - Error handling for invalid keys
 * 
 * These tests verify ACTUAL behavior, not mocks of the component being tested.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// We'll import the component after it exists
// For now, this test should FAIL because component doesn't exist

describe('Admin API Key Configuration - Integration Contract', () => {
  let fetchSpy;
  
  beforeEach(() => {
    // Spy on fetch to verify REAL API calls
    fetchSpy = vi.spyOn(global, 'fetch');
    
    // Mock fetch responses
    fetchSpy.mockImplementation((url, options) => {
      // GET /api/config/apikey/status
      if (url.includes('/api/config/apikey/status') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ configured: false, updatedAt: null })
        });
      }
      
      // POST /api/config/apikey
      if (url.includes('/api/config/apikey') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        if (body.apiKey && body.apiKey.startsWith('sk-ant-')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, message: 'API key stored securely on server' })
          });
        } else {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: 'Invalid API key format' })
          });
        }
      }
      
      // Default: return empty response
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Settings Tab in Admin Dashboard', () => {
    it('should display Settings tab in admin dashboard', async () => {
      // Import dynamically to test if component exists
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      // MUST find a Settings tab - this is the CONTRACT
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      expect(settingsTab).toBeInTheDocument();
    });
    
    it('should show API key configuration section when Settings tab is clicked', async () => {
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      // Click Settings tab
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(settingsTab);
      
      // MUST show API key section - use testid to be specific
      expect(screen.getByTestId('api-key-settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument();
    });
  });
  
  describe('API Key Input and Save', () => {
    it('should have input field for API key', async () => {
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      // Navigate to settings
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      await userEvent.click(settingsTab);
      
      // MUST have password-type input for security
      const input = screen.getByLabelText(/anthropic api key/i);
      expect(input).toHaveAttribute('type', 'password');
    });
    
    it('should call /api/config/apikey when save is clicked with valid key', async () => {
      const user = userEvent.setup();
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      // Navigate to settings
      await user.click(screen.getByRole('button', { name: /settings/i }));
      
      // Enter API key
      const input = screen.getByLabelText(/anthropic api key/i);
      await user.type(input, 'sk-ant-test-key-12345');
      
      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      // VERIFY: fetch was called with correct URL and method
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/config/apikey'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('sk-ant-test-key-12345')
          })
        );
      });
    });
    
    it('should show success message after saving valid key', async () => {
      const user = userEvent.setup();
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      await user.click(screen.getByRole('button', { name: /settings/i }));
      
      const input = screen.getByLabelText(/anthropic api key/i);
      await user.type(input, 'sk-ant-test-key-12345');
      
      await user.click(screen.getByRole('button', { name: /save/i }));
      
      // MUST show success message
      await waitFor(() => {
        expect(screen.getByText(/success|saved|stored/i)).toBeInTheDocument();
      });
    });
    
    it('should show error for invalid API key format', async () => {
      const user = userEvent.setup();
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      await user.click(screen.getByRole('button', { name: /settings/i }));
      
      const input = screen.getByLabelText(/anthropic api key/i);
      await user.type(input, 'invalid-key-format');
      
      await user.click(screen.getByRole('button', { name: /save/i }));
      
      // MUST show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid|error|format/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('API Key Status Display', () => {
    it('should check API key status on mount', async () => {
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      // Navigate to settings
      await userEvent.click(screen.getByRole('button', { name: /settings/i }));
      
      // VERIFY: status endpoint was called
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/config/apikey/status'),
          expect.any(Object)
        );
      });
    });
    
    it('should show "Not Configured" when API key is not set', async () => {
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      await userEvent.click(screen.getByRole('button', { name: /settings/i }));
      
      // MUST show not configured status
      await waitFor(() => {
        expect(screen.getByText(/not configured|not set|missing/i)).toBeInTheDocument();
      });
    });
    
    it('should show "Configured" when API key is set', async () => {
      // Override mock to return configured=true
      fetchSpy.mockImplementation((url) => {
        if (url.includes('/api/config/apikey/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              configured: true, 
              updatedAt: '2026-01-19T10:00:00Z' 
            })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      
      const { default: DrugReviewDashboard } = await import('../../components/Admin/DrugReviewDashboard.jsx');
      
      render(<DrugReviewDashboard />);
      
      await userEvent.click(screen.getByRole('button', { name: /settings/i }));
      
      // MUST show configured status - use specific class
      await waitFor(() => {
        const statusIndicator = screen.getByTestId('api-key-settings').querySelector('.status-indicator.configured');
        expect(statusIndicator).toBeInTheDocument();
      });
    });
  });
});
